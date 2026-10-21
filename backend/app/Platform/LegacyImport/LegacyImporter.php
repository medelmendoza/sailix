<?php

namespace App\Platform\LegacyImport;

use App\Enums\MembershipStatus;
use App\Enums\Role;
use App\Enums\TenantStatus;
use App\Models\Announcement;
use App\Models\AnnouncementFleet;
use App\Models\CrewDocument;
use App\Models\CrewProfile;
use App\Models\DocumentType;
use App\Models\Membership;
use App\Models\Tenant;
use App\Models\Todo;
use App\Support\Audit;
use App\Support\DocumentFiles;
use Illuminate\Database\Connection;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Ramsey\Uuid\Uuid;
use RuntimeException;
use Symfony\Component\Finder\Finder;

/**
 * Copies the OLD single-organization Sailix database into v2 (docs/18-LEGACY-IMPORT.md).
 *
 * Sanctioned cross-tenant code (it lives under app/Platform). The old database is only ever read. Every row gets an id
 * derived from its old id (UUID v5), so running the import again updates rows instead of duplicating them. Nothing it
 * reports contains personal data, only counts and old ids.
 */
final class LegacyImporter
{
    /** Fixed namespace for the ids derived from old ids. Never change it: it would make every re-run create duplicates. */
    private const NAMESPACE = '6f1c2b7e-3b8e-4f6c-9a53-5d1a0b0f7a11';

    private Connection $old;

    private ImportReport $report;

    private ?string $files = null;

    /** @var array<string, string>|null basename => path, built once */
    private ?array $fileIndex = null;

    private bool $dryRun = false;

    /** @var array<string, string> old userID => membership id (users that were imported) */
    private array $members = [];

    /** @var array<string, string> old crewID => membership id */
    private array $crew = [];

    public function __construct(private readonly string $connection = 'legacy') {}

    /** @throws RuntimeException when the source or the target is not what it must be. Nothing is read before these hold. */
    public function guard(bool $allowWritableSource = false, bool $sameDatabase = false): void
    {
        $default = config('database.connections.'.config('database.default'));
        $legacy = config('database.connections.'.$this->connection);
        if (empty($legacy['database'])) {
            throw new RuntimeException('The old database is not configured (LEGACY_DB_*).');
        }
        $same = fn (string $k) => ($default[$k] ?? null) === ($legacy[$k] ?? null);
        $isSame = $same('driver') && $same('host') && $same('port') && $same('database');
        if ($isSame && ! $sameDatabase) {
            throw new RuntimeException('The old database and the v2 database are the same one. Refusing to continue (use --same-database if the v2 tables were created next to the old ones on purpose).');
        }
        if (! $isSame && $sameDatabase) {
            throw new RuntimeException('--same-database was given, but the old database is not the v2 database.');
        }

        $old = DB::connection($this->connection);
        $schema = Schema::connection($this->connection);
        if (! $schema->hasTable('tb_user')) {
            throw new RuntimeException('The source does not look like the old Sailix database (needs tb_user).');
        }
        if ($schema->hasTable('tenants') && ! $sameDatabase) {
            throw new RuntimeException('The source does not look like the old Sailix database (it has v2 tables: tenants).');
        }
        if (! Schema::hasTable('tenants') || (Schema::hasTable('tb_user') && ! $sameDatabase)) {
            throw new RuntimeException('The target is not a v2 database (needs tenants, must not have tb_user unless --same-database). Run the v2 migrations on it first.');
        }
        if ($sameDatabase) {
            return; // the old tables live next to the v2 ones, so the account that writes v2 also sees the old data: nothing more to check
        }

        if ($old->getDriverName() === 'mysql' && ! $allowWritableSource) {
            $grants = json_encode($old->select('show grants'));
            if (preg_match('/ALL PRIVILEGES|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b|\bALTER\b/i', (string) $grants)) {
                throw new RuntimeException('The old database user can write. Use a read-only user (or --allow-writable-source if you are sure).');
            }
        }
    }

    public function import(bool $dryRun, ?string $filesPath, bool $includeLicenses, ?string $tenantCode = null): ImportReport
    {
        $this->old = DB::connection($this->connection);
        $this->report = new ImportReport;
        $this->dryRun = $dryRun;
        $this->files = $filesPath;
        $this->fileIndex = null;
        $this->members = [];
        $this->crew = [];

        if ($filesPath !== null && ! is_dir($filesPath)) {
            throw new RuntimeException('The files folder does not exist.');
        }

        $run = function () use ($includeLicenses, $tenantCode) {
            $tenant = $this->tenant($tenantCode);
            $this->people($tenant);
            $types = $this->documentTypes($tenant, $includeLicenses);
            $this->documents($tenant, $types);
            $this->announcements($tenant);
            $this->todos($tenant);
        };

        if ($dryRun) {
            // The same code runs, so conflicts show up exactly as they would; then everything is undone.
            DB::beginTransaction();
            try {
                $run();
            } finally {
                DB::rollBack();
            }
            $this->report->note('dry run: nothing was written');
        } else {
            DB::transaction($run);
        }

        return $this->report;
    }

    // ---- organization -----------------------------------------------------------------------------------------------

    private function tenant(?string $code): Tenant
    {
        $codes = $this->old->table('tb_user')->distinct()->pluck('client_code')->filter()->values();
        $code ??= (string) $codes->first();
        if ($code === '') {
            throw new RuntimeException('The old users have no client_code.');
        }
        if ($codes->count() > 1) {
            $this->report->note('several client codes found ('.$codes->implode(', ').'); only '.$code.' is imported');
        }

        $tenant = Tenant::where('code', $code)->first();
        if ($tenant === null) {
            $tenant = (new Tenant)->forceFill([
                'code' => $code,
                'name' => $code,
                'status' => TenantStatus::Provisioning,
            ]);
            $tenant->save();
            Audit::record('legacy.organization_created', $tenant->getKey(), $tenant, ['code' => $code]);
            $this->report->created('organization');
        } else {
            $this->report->note("organization {$code} already exists and is used as it is");
        }

        return $tenant;
    }

    // ---- people -----------------------------------------------------------------------------------------------------

    private function people(Tenant $tenant): void
    {
        $rows = $this->old->table('tb_user')->where('client_code', $tenant->code)->orderBy('userID')->get();

        // One person with two logins (same email): the administrator account is kept, the other is left for a decision.
        $byEmail = $rows->groupBy(fn ($r) => mb_strtolower(trim((string) $r->email_address)));
        $skip = [];
        foreach ($byEmail as $group) {
            if ($group->count() > 1) {
                $keep = $group->firstWhere('userType', 'ROLE_ADMIN') ?? $group->first();
                foreach ($group as $r) {
                    if ($r->userID !== $keep->userID) {
                        $skip[$r->userID] = 'same email as another account (kept '.$keep->userID.')';
                    }
                }
            }
        }

        $crewNumbers = [];
        foreach ($rows as $r) {
            if (isset($skip[$r->userID])) {
                $this->report->skipped('user', $r->userID, $skip[$r->userID]);

                continue;
            }
            $email = mb_strtolower(trim((string) $r->email_address));
            $userId = $this->id('user', $r->userID);

            if ($email === '' || trim((string) $r->username) === '') {
                $this->report->skipped('user', $r->userID, 'no username or email (v2 needs both to sign in)');

                continue;
            }

            $clash = DB::table('users')->where('id', '!=', $userId)
                ->where(fn ($q) => $q->where('email', $email)->orWhere('username', $r->username))->exists();
            if ($clash) {
                $this->report->skipped('user', $r->userID, 'email or username already used by another v2 account');

                continue;
            }

            $inactive = strtoupper((string) $r->is_inactive) === 'Y';
            $exists = DB::table('users')->where('id', $userId)->exists();
            // Written with the query builder, not the model: the model would hash the (already hashed) password again.
            $values = [
                'username' => $this->fit($r->username, 255),
                'email' => $this->fit($email, 255),
                'display_name' => $this->fit(trim($r->first_name.' '.$r->last_name), 255),
                'password' => $r->password,
                'status' => $inactive ? 'suspended' : 'active',
                'updated_at' => $this->time($r->updated_at),
            ];
            if ($exists) {
                DB::table('users')->where('id', $userId)->update($values);
                $this->report->updated('user');
            } else {
                DB::table('users')->insert($values + ['id' => $userId, 'created_at' => $this->time($r->created_at)]);
                $this->report->created('user');
            }

            $role = $r->userType === 'ROLE_ADMIN' ? Role::TenantAdmin : Role::Crew;
            $membership = $this->upsert(Membership::withoutTenantScope(), new Membership, $this->id('membership', $r->userID), [
                'tenant_id' => $tenant->id, 'user_id' => $userId, 'role' => $role,
                'status' => $inactive ? MembershipStatus::Suspended : MembershipStatus::Active,
            ], 'membership', $r);
            $this->members[$r->userID] = $membership->id;

            $crewNumber = trim((string) $r->crewID) !== '' ? $this->fit(trim($r->crewID), 30) : null;
            if ($crewNumber !== null) {
                $this->crew[$crewNumber] = $membership->id;
                if (isset($crewNumbers[$crewNumber])) {
                    $this->report->note("crew number of user {$r->userID} is also used by {$crewNumbers[$crewNumber]}: left empty");
                    $crewNumber = null;
                } else {
                    $crewNumbers[$crewNumber] = $r->userID;
                }
            }
            $mobile = trim((string) $r->mobile_number);
            if (strlen($mobile) > 20) {
                $this->report->note("mobile number of user {$r->userID} is longer than 20 characters: left empty");
                $mobile = '';
            }
            $this->upsert(CrewProfile::withoutTenantScope(), new CrewProfile, $this->id('profile', $r->userID), [
                'tenant_id' => $tenant->id, 'membership_id' => $membership->id,
                'first_name' => $this->fit($r->first_name, 100) ?: '-', 'middle_name' => $this->fit($r->middle_name, 100),
                'last_name' => $this->fit($r->last_name, 100) ?: '-', 'suffix' => $this->fit($r->suffix_name, 20),
                'crew_number' => $crewNumber, 'mobile' => $mobile !== '' ? $mobile : null,
                'birthday' => $r->dateof_birth ? Carbon::parse($r->dateof_birth)->toDateString() : null,
            ], 'profile', $r);
        }
    }

    // ---- documents --------------------------------------------------------------------------------------------------

    /** @return array<string, DocumentType> by old docID */
    private function documentTypes(Tenant $tenant, bool $includeLicenses): array
    {
        $used = $this->old->table('tb_crew_document_upload')->distinct()->pluck('docID')->all();
        $kinds = $this->old->table('pl_documents')->orderBy('docID')->get()->filter(function ($d) use ($used, $includeLicenses) {
            return in_array($d->docID, $used, true) || ($includeLicenses && strtoupper((string) $d->is_license) === 'Y');
        });
        if ($kinds->isEmpty() && $used !== []) {
            $this->report->note('crew documents refer to document kinds that are not in pl_documents');
        }

        $taken = DocumentType::withoutTenantScope()->where('tenant_id', $tenant->id)->pluck('id', 'name')->all();
        $out = [];
        foreach ($kinds as $d) {
            $id = $this->id('doctype', $d->docID);
            $name = $this->fit(trim($d->document_name), 120) ?: $d->docID;
            // a name is unique per organization: a repeated one gets its short name, then its old id, so none is lost
            foreach ([$name, $this->fit($name.' ('.trim($d->document_shortname).')', 120), $this->fit($name.' ('.$d->docID.')', 120)] as $candidate) {
                if (! isset($taken[$candidate]) || $taken[$candidate] === $id) {
                    $name = $candidate;
                    break;
                }
            }
            $taken[$name] = $id;
            $out[$d->docID] = $this->upsert(DocumentType::withoutTenantScope(), new DocumentType, $id, [
                'tenant_id' => $tenant->id, 'name' => $name, 'short_name' => $this->fit(trim($d->document_shortname), 40),
                'is_active' => strtoupper((string) $d->is_inactive) !== 'Y',
            ], 'document type', $d);
        }

        return $out;
    }

    /** @param array<string, DocumentType> $types */
    private function documents(Tenant $tenant, array $types): void
    {
        $rows = $this->old->table('tb_crew_document_upload')->orderBy('crewdocID')->get();
        foreach ($rows as $r) {
            $why = null;
            $membershipId = $this->crew[trim((string) $r->crewID)] ?? null;
            if (strtoupper((string) $r->is_inactive) === 'Y') {
                $why = 'inactive in the old system';
            } elseif ($membershipId === null) {
                $why = 'its crew member was not imported';
            } elseif (! isset($types[$r->docID])) {
                $why = 'its document kind was not imported';
            }
            $file = $why === null ? $this->locate((string) $r->app_file_name) : null;
            if ($why === null && $file === null) {
                $why = $this->files === null ? 'no files folder given, and v2 needs the file' : 'file not found in the files folder';
            }
            $bytes = $why === null ? (string) file_get_contents($file) : '';
            $mime = $why === null ? $this->mime($bytes) : null;
            if ($why === null && $mime === null) {
                $why = 'file is not a PDF, JPEG or PNG';
            }
            if ($why !== null) {
                $this->report->skipped('document', $r->crewdocID, $why);

                continue;
            }

            $status = (strtoupper((string) $r->is_rejected) === 'Y' || $r->approval_status === 'Rejected') ? 'rejected'
                : ($r->approval_status === 'Approved' ? 'approved' : 'pending');
            $ext = ['application/pdf' => 'pdf', 'image/jpeg' => 'jpg', 'image/png' => 'png'][$mime];
            $path = "documents/{$tenant->id}/legacy-".sha1($r->crewdocID).'.'.$ext;
            $this->put($path, $bytes);
            $this->upsert(CrewDocument::withoutTenantScope(), new CrewDocument, $this->id('document', $r->crewdocID), [
                'tenant_id' => $tenant->id, 'membership_id' => $membershipId, 'document_type_id' => $types[$r->docID]->id,
                'number' => $this->fit($r->doc_number, 80), 'grade' => $this->fit($r->grade, 80),
                'location' => $this->fit($r->location, 120), 'school' => $this->fit($r->school, 120),
                'issued_on' => $r->date_issued ? Carbon::parse($r->date_issued)->toDateString() : null,
                'expires_on' => $r->date_expired ? Carbon::parse($r->date_expired)->toDateString() : null,
                'status' => $status, 'rejection_reason' => $status === 'rejected' ? $this->fit($r->rejection_reason ?: $r->remarks, 500) : null,
                'reviewed_by_membership_id' => $status === 'pending' ? null : ($this->members[$r->approved_by] ?? null),
                'reviewed_at' => $status === 'pending' ? null : $this->time($r->updated_at),
                'file_disk' => DocumentFiles::disk(), 'file_path' => $path,
                'file_original_name' => $this->fit(basename((string) $r->app_file_name), 150) ?: 'document',
                'file_mime' => $mime, 'file_size' => strlen($bytes), 'submitted_at' => $this->time($r->created_at) ?? now(),
            ], 'document', $r);
        }
        if ($this->old->table('tb_crew_document')->exists()) {
            $this->report->note('tb_crew_document ('.$this->old->table('tb_crew_document')->count().' rows) is not imported: its crew ids match no user and none has a file');
        }
    }

    // ---- announcements and to-dos -----------------------------------------------------------------------------------

    private function announcements(Tenant $tenant): void
    {
        foreach ($this->old->table('tb_announcement')->orderBy('announceID')->get() as $r) {
            $id = $this->id('announcement', $r->announceID);
            $attachment = [];
            $name = trim((string) $r->filename);
            if ($name !== '') {
                $file = $this->locate($name);
                $mime = $file ? $this->mime((string) file_get_contents($file)) : null;
                if ($file && $mime) {
                    $bytes = (string) file_get_contents($file);
                    $ext = ['application/pdf' => 'pdf', 'image/jpeg' => 'jpg', 'image/png' => 'png'][$mime];
                    $path = "announcements/{$tenant->id}/legacy-".sha1($r->announceID).'.'.$ext;
                    $this->put($path, $bytes);
                    $attachment = ['file_disk' => DocumentFiles::disk(), 'file_path' => $path, 'file_original_name' => $this->fit(basename($name), 150),
                        'file_mime' => $mime, 'file_size' => strlen($bytes)];
                } else {
                    $this->report->note("announcement {$r->announceID} imported without its attachment (".($file ? 'not a PDF, JPEG or PNG' : 'file not found').')');
                }
            }
            $announcement = $this->upsert(Announcement::withoutTenantScope(), new Announcement, $id, [
                'tenant_id' => $tenant->id, 'created_by_membership_id' => $this->members[$r->creatorID] ?? null,
                'title' => $this->fit(trim($r->title), 150) ?: '-', 'body' => (string) $r->description,
                'is_active' => strtoupper((string) $r->is_inactive) !== 'Y',
                'expires_at' => $r->date_expired ? Carbon::parse($r->date_expired)->endOfDay() : null,
            ] + ($attachment ?: ['file_disk' => null, 'file_path' => null, 'file_original_name' => null, 'file_mime' => null, 'file_size' => null]), 'announcement', $r);

            // The old "group" is the nearest thing to a fleet (the audience of an announcement in v2).
            AnnouncementFleet::withoutTenantScope()->where('announcement_id', $announcement->id)->delete();
            foreach (array_filter(array_map('trim', explode(',', (string) $r->groupNames))) as $group) {
                $this->upsert(AnnouncementFleet::withoutTenantScope(), new AnnouncementFleet, $this->id('fleet', $r->announceID.'|'.$group), [
                    'tenant_id' => $tenant->id, 'announcement_id' => $announcement->id, 'fleet' => $this->fit($group, 100),
                ], 'announcement audience', $r);
                $this->report->note("announcement {$r->announceID} is addressed to the group \"{$group}\" as a fleet: only crew whose fleet is exactly that will see it");
            }
        }
    }

    private function todos(Tenant $tenant): void
    {
        foreach ($this->old->table('tb_to_do_list')->orderBy('todoID')->get() as $r) {
            $owner = $this->members[$r->userID] ?? null;
            if ($owner === null) {
                $this->report->skipped('to-do', $r->todoID, 'its user was not imported');

                continue;
            }
            $done = $r->todo_status === 'Completed';
            $this->upsert(Todo::withoutTenantScope(), new Todo, $this->id('todo', $r->todoID), [
                'tenant_id' => $tenant->id, 'membership_id' => $owner, 'created_by_membership_id' => $this->members[$r->creatorID] ?? null,
                'description' => $this->fit(trim((string) $r->todo_description), 500) ?: '-',
                'due_date' => $r->todo_due_date ? Carbon::parse($r->todo_due_date)->toDateString() : null,
                'is_done' => $done, 'done_at' => $done ? $this->time($r->updated_at) : null,
            ], 'to-do', $r);
        }
    }

    // ---- helpers ----------------------------------------------------------------------------------------------------

    /** The id a row gets in v2, derived from its old id so a re-run finds it again. */
    private function id(string $kind, string $legacyId): string
    {
        return Uuid::uuid5(self::NAMESPACE, $kind.':'.$legacyId)->toString();
    }

    /**
     * Creates or updates one row by its derived id, keeping the old timestamps.
     *
     * @template T of Model
     *
     * @param  Builder<T>  $query
     * @param  array<string, mixed>  $values
     * @return T
     */
    private function upsert($query, Model $model, string $id, array $values, string $entity, object $legacy): Model
    {
        $row = $query->whereKey($id)->first();
        $created = $row === null;
        $row ??= $model->forceFill(['id' => $id]);
        $row->timestamps = false; // the old created/updated times are kept
        $row->forceFill($values + [
            'created_at' => $row->created_at ?? $this->time($legacy->created_at ?? null) ?? now(),
            'updated_at' => $this->time($legacy->updated_at ?? null) ?? now(),
        ])->save();
        $created ? $this->report->created($entity) : $this->report->updated($entity);

        return $row;
    }

    private function fit(mixed $value, int $max): ?string
    {
        if ($value === null || trim((string) $value) === '') {
            return null;
        }

        return mb_substr(trim((string) $value), 0, $max);
    }

    private function time(mixed $value): ?Carbon
    {
        return $value ? Carbon::parse($value) : null;
    }

    private function locate(string $name): ?string
    {
        $name = basename(trim($name));
        if ($this->files === null || $name === '') {
            return null;
        }
        if ($this->fileIndex === null) {
            $this->fileIndex = [];
            foreach ((new Finder)->files()->in($this->files) as $f) {
                $this->fileIndex[$f->getFilename()] ??= $f->getRealPath();
            }
        }

        return $this->fileIndex[$name] ?? null;
    }

    /** What a file really is, from its content (never from its name). Null when it may not be stored. */
    private function mime(string $bytes): ?string
    {
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->buffer($bytes);

        return in_array($mime, ['application/pdf', 'image/jpeg', 'image/png'], true) ? $mime : null;
    }

    private function put(string $path, string $bytes): void
    {
        if (! $this->dryRun) {
            Storage::disk(DocumentFiles::disk())->put($path, $bytes);
        }
    }
}

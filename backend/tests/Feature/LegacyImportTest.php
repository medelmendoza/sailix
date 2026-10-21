<?php

namespace Tests\Feature;

use App\Models\Announcement;
use App\Models\AnnouncementFleet;
use App\Models\CrewDocument;
use App\Models\CrewProfile;
use App\Models\DocumentType;
use App\Models\Membership;
use App\Models\Tenant;
use App\Models\Todo;
use App\Platform\LegacyImport\LegacyImporter;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** The old Sailix database is stood in for by an in-memory SQLite database with the old table structure and invented rows. */
class LegacyImportTest extends TestCase
{
    private string $files;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        config(['sailix.documents.disk' => 'local', 'database.connections.legacy' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '', 'foreign_key_constraints' => false]]);
        DB::purge('legacy');
        $this->buildLegacy();
        $this->files = sys_get_temp_dir().'/legacy-files-'.bin2hex(random_bytes(4));
        mkdir($this->files.'/sub', 0777, true);
        file_put_contents($this->files.'/sub/passport.pdf', "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");
        file_put_contents($this->files.'/notes.pdf', 'this is plain text, not a pdf');
    }

    protected function tearDown(): void
    {
        foreach (glob($this->files.'/*') ?: [] as $f) {
            is_dir($f) ? array_map('unlink', glob("$f/*") ?: []) && rmdir($f) : unlink($f);
        }
        @rmdir($this->files);
        parent::tearDown();
    }

    /** One insert per row: the old rows do not all carry the same columns. */
    private function rows(string $table, array $rows): void
    {
        foreach ($rows as $row) {
            DB::connection('legacy')->table($table)->insert($row);
        }
    }

    private function buildLegacy(): void
    {
        $s = Schema::connection('legacy');
        $s->create('tb_user', function (Blueprint $t) {
            foreach (['userID', 'userType', 'last_name', 'first_name', 'email_address', 'username', 'password', 'is_inactive', 'client_code'] as $c) {
                $t->string($c);
            }
            foreach (['middle_name', 'suffix_name', 'gender', 'mobile_number', 'crewID', 'is_app_registration', 'is_first_time'] as $c) {
                $t->string($c)->nullable();
            }
            $t->date('dateof_birth')->nullable();
            $t->timestamp('created_at')->nullable();
            $t->timestamp('updated_at')->nullable();
        });
        $s->create('pl_documents', function (Blueprint $t) {
            foreach (['id', 'docID', 'document_name', 'document_shortname', 'is_license', 'is_inactive'] as $c) {
                $t->string($c)->nullable();
            }
            $t->timestamps();
        });
        $s->create('tb_crew_document', function (Blueprint $t) {
            $t->string('crewdocID');
            $t->string('crewID')->nullable();
            $t->string('docID')->nullable();
        });
        $s->create('tb_crew_document_upload', function (Blueprint $t) {
            foreach (['crewdocID', 'crewID', 'docID', 'doc_number'] as $c) {
                $t->string($c);
            }
            foreach (['grade', 'location', 'school', 'uploaded_by', 'file_type', 'app_file_name', 'approved_by', 'approval_status', 'rejection_reason', 'remarks', 'is_checking', 'is_rejected', 'is_inactive'] as $c) {
                $t->string($c)->nullable();
            }
            $t->date('date_issued')->nullable();
            $t->date('date_expired')->nullable();
            $t->timestamp('created_at')->nullable();
            $t->timestamp('updated_at')->nullable();
        });
        $s->create('tb_announcement', function (Blueprint $t) {
            foreach (['announceID', 'title', 'creatorID', 'creatorName'] as $c) {
                $t->string($c);
            }
            $t->text('description');
            foreach (['groupNames', 'employmentStatus', 'filename', 'fileType', 'location', 'is_inactive'] as $c) {
                $t->string($c)->nullable();
            }
            $t->date('date_expired')->nullable();
            $t->timestamp('created_at')->nullable();
            $t->timestamp('updated_at')->nullable();
        });
        $s->create('tb_to_do_list', function (Blueprint $t) {
            foreach (['todoID', 'creatorID', 'userID', 'todo_status'] as $c) {
                $t->string($c);
            }
            $t->text('todo_description')->nullable();
            $t->date('todo_due_date')->nullable();
            $t->string('isViewed')->nullable();
            $t->timestamp('created_at')->nullable();
            $t->timestamp('updated_at')->nullable();
        });

        $hash = Hash::make('old-secret', ['rounds' => 10]); // the old app's cost differs from v2's
        $user = fn (string $id, string $type, string $username, string $email, array $more = []) => $more + [
            'userID' => $id, 'userType' => $type, 'last_name' => 'Santos', 'first_name' => 'Maria', 'email_address' => $email, 'username' => $username,
            'password' => $hash, 'is_inactive' => 'N', 'client_code' => 'OLDCO', 'created_at' => '2024-01-02 03:04:05', 'updated_at' => '2024-02-03 04:05:06',
        ];
        $this->rows('tb_user', [
            $user('U-ADMIN', 'ROLE_ADMIN', 'boss', 'boss@example.test', ['first_name' => 'Big', 'last_name' => 'Boss']),
            $user('U-CREW1', 'ROLE_USER', 'maria', 'maria@example.test', ['crewID' => '09977', 'dateof_birth' => '1990-05-06', 'mobile_number' => '+639171234567']),
            $user('U-CREW2', 'ROLE_USER', 'juan', 'juan@example.test', ['crewID' => '09978', 'is_inactive' => 'Y']),
            $user('U-DUP', 'ROLE_USER', 'boss2', 'Boss@Example.test'), // same person as the admin, second login
            $user('U-NOCREW', 'ROLE_USER', 'pat', 'pat@example.test'),
            $user('U-BLANK', 'ROLE_USER', '', '', ['crewID' => '09979']), // a crew member who could never sign in
        ]);
        $this->rows('pl_documents', [
            ['id' => '1', 'docID' => 'D-PASS', 'document_name' => 'Passport', 'document_shortname' => 'PASS', 'is_license' => 'N', 'is_inactive' => 'N'],
            ['id' => '2', 'docID' => 'D-PASS2', 'document_name' => 'Passport', 'document_shortname' => 'PSP', 'is_license' => 'Y', 'is_inactive' => 'N'],
            ['id' => '3', 'docID' => 'D-UNUSED', 'document_name' => 'Unused licence', 'document_shortname' => 'UNU', 'is_license' => 'Y', 'is_inactive' => 'N'],
            ['id' => '4', 'docID' => 'D-OTHER', 'document_name' => 'Not licence, not used', 'document_shortname' => 'NLU', 'is_license' => 'N', 'is_inactive' => 'N'],
        ]);
        $this->rows('tb_crew_document', [['crewdocID' => 'CD-1', 'crewID' => 'GHOST', 'docID' => 'D-PASS']]);
        $up = fn (string $id, array $more = []) => $more + [
            'crewdocID' => $id, 'crewID' => '09977', 'docID' => 'D-PASS', 'doc_number' => 'P123', 'approval_status' => 'Pending', 'is_inactive' => 'N',
            'is_rejected' => 'N', 'app_file_name' => 'passport.pdf', 'created_at' => '2024-03-01 10:00:00', 'updated_at' => '2024-03-02 10:00:00',
            'date_issued' => '2023-01-01', 'date_expired' => '2030-01-01',
        ];
        $this->rows('tb_crew_document_upload', [
            $up('UP-OK'),
            $up('UP-APPROVED', ['approval_status' => 'Approved', 'approved_by' => 'U-ADMIN', 'docID' => 'D-PASS2']),
            $up('UP-REJECTED', ['is_rejected' => 'Y', 'rejection_reason' => 'Blurry']),
            $up('UP-NOFILE', ['app_file_name' => 'missing.pdf']),
            $up('UP-NOTPDF', ['app_file_name' => 'notes.pdf']),
            $up('UP-NOCREW', ['crewID' => 'NOBODY']),
            $up('UP-INACTIVE', ['is_inactive' => 'Y']),
        ]);
        $this->rows('tb_announcement', [
            ['announceID' => 'A-1', 'title' => 'Drill', 'description' => 'Muster at ten.', 'creatorID' => 'U-ADMIN', 'creatorName' => 'x', 'groupNames' => 'ABACUS', 'employmentStatus' => 'VACATION',
                'filename' => 'passport.pdf', 'is_inactive' => 'N', 'date_expired' => '2030-01-01', 'created_at' => '2024-04-01 08:00:00', 'updated_at' => '2024-04-01 08:00:00'],
        ]);
        $this->rows('tb_to_do_list', [
            ['todoID' => 'T-1', 'creatorID' => 'U-ADMIN', 'userID' => 'U-CREW1', 'todo_status' => 'New', 'todo_description' => 'Renew medical', 'todo_due_date' => '2030-02-02'],
            ['todoID' => 'T-2', 'creatorID' => 'U-ADMIN', 'userID' => 'U-CREW1', 'todo_status' => 'Completed', 'todo_description' => 'Sign contract', 'updated_at' => '2024-05-05 05:05:05'],
            ['todoID' => 'T-3', 'creatorID' => 'U-ADMIN', 'userID' => 'GHOST', 'todo_status' => 'New', 'todo_description' => 'Nobody'],
        ]);
    }

    private function run_(bool $dry = false, bool $files = true, bool $licenses = false)
    {
        $importer = new LegacyImporter;
        $importer->guard();

        return $importer->import($dry, $files ? $this->files : null, $licenses);
    }

    private function counts(): array
    {
        return [
            'tenants' => Tenant::count(), 'users' => DB::table('users')->count(),
            'memberships' => Membership::withoutTenantScope()->count(), 'profiles' => CrewProfile::withoutTenantScope()->count(),
            'types' => DocumentType::withoutTenantScope()->count(), 'documents' => CrewDocument::withoutTenantScope()->count(),
            'announcements' => Announcement::withoutTenantScope()->count(), 'fleets' => AnnouncementFleet::withoutTenantScope()->count(),
            'todos' => Todo::withoutTenantScope()->count(),
        ];
    }

    public function test_people_come_across_with_their_roles_passwords_and_details(): void
    {
        $report = $this->run_();

        $tenant = Tenant::where('code', 'OLDCO')->firstOrFail();
        $this->assertSame('provisioning', $tenant->status->value);
        $this->assertSame('oldco', $tenant->slug);

        // 6 old accounts: one is a second login of the admin and one has no username or email, so 4 users
        $this->assertSame(4, DB::table('users')->count());
        $this->assertDatabaseMissing('users', ['username' => 'boss2']);
        $this->assertNull(CrewProfile::withoutTenantScope()->where('crew_number', '09979')->first()); // no username or email: skipped, not half-imported
        $this->assertStringContainsString('U-BLANK: no username or email', implode("\n", $report->notes));
        $this->assertTrue(Hash::check('old-secret', DB::table('users')->where('username', 'maria')->value('password'))); // old hash kept as it is

        $roles = Membership::withoutTenantScope()->where('tenant_id', $tenant->id)->get()->mapWithKeys(fn ($m) => [$m->user->username => $m->role->value]);
        $this->assertEqualsCanonicalizing(['boss' => 'tenant_admin', 'maria' => 'crew', 'juan' => 'crew', 'pat' => 'crew'], $roles->all());
        $juan = Membership::withoutTenantScope()->where('user_id', DB::table('users')->where('username', 'juan')->value('id'))->first();
        $this->assertSame('suspended', $juan->status->value);

        $maria = CrewProfile::withoutTenantScope()->where('crew_number', '09977')->firstOrFail();
        $this->assertSame('1990-05-06', $maria->birthday->toDateString());
        $this->assertSame('+639171234567', $maria->mobile);
        $this->assertSame('2024-01-02 03:04:05', $maria->created_at->format('Y-m-d H:i:s')); // the old times are kept
    }

    public function test_documents_need_their_file_and_a_real_type_and_keep_their_review_state(): void
    {
        $report = $this->run_();

        $docs = CrewDocument::withoutTenantScope()->get()->keyBy('number')->count();
        $this->assertSame(3, CrewDocument::withoutTenantScope()->count()); // OK, APPROVED, REJECTED
        $byStatus = CrewDocument::withoutTenantScope()->pluck('status')->sort()->values()->all();
        $this->assertSame(['approved', 'pending', 'rejected'], $byStatus);
        $rejected = CrewDocument::withoutTenantScope()->where('status', 'rejected')->first();
        $this->assertSame('Blurry', $rejected->rejection_reason);
        $approved = CrewDocument::withoutTenantScope()->where('status', 'approved')->first();
        $this->assertNotNull($approved->reviewed_by_membership_id);
        Storage::disk('local')->assertExists($approved->file_path);
        $this->assertSame('application/pdf', $approved->file_mime);

        $skipped = collect($report->notes)->filter(fn ($n) => str_starts_with($n, 'skipped document'))->implode("\n");
        $this->assertStringContainsString('UP-NOFILE: file not found', $skipped);
        $this->assertStringContainsString('UP-NOTPDF: file is not a PDF', $skipped);
        $this->assertStringContainsString('UP-NOCREW: its crew member was not imported', $skipped);
        $this->assertStringContainsString('UP-INACTIVE: inactive', $skipped);
        $this->assertStringNotContainsString('maria', $skipped, 'reports never carry personal details');
        $this->assertGreaterThan(0, $docs);
    }

    public function test_without_a_files_folder_no_document_is_imported_but_the_rest_is(): void
    {
        $report = $this->run_(files: false);

        $this->assertSame(0, CrewDocument::withoutTenantScope()->count());
        $this->assertSame(4, DB::table('users')->count());
        $this->assertStringContainsString('no files folder given', implode("\n", $report->notes));
        $this->assertSame(1, Announcement::withoutTenantScope()->count());
        $this->assertNull(Announcement::withoutTenantScope()->first()->file_path); // imported without its attachment
    }

    public function test_only_document_kinds_in_use_are_imported_with_repeated_names_told_apart(): void
    {
        $this->run_();
        $names = DocumentType::withoutTenantScope()->pluck('name')->sort()->values()->all();
        $this->assertSame(['Passport', 'Passport (PSP)'], $names); // D-PASS and D-PASS2 are used; the other two are not

        $this->run_(licenses: true);
        $this->assertContains('Unused licence', DocumentType::withoutTenantScope()->pluck('name')->all());
        $this->assertNotContains('Not licence, not used', DocumentType::withoutTenantScope()->pluck('name')->all());
    }

    public function test_announcements_and_todos(): void
    {
        $report = $this->run_();

        $a = Announcement::withoutTenantScope()->firstOrFail();
        $this->assertSame('Drill', $a->title);
        $this->assertTrue($a->is_active);
        $this->assertNotNull($a->file_path); // attached from the files folder
        $this->assertSame(['ABACUS'], AnnouncementFleet::withoutTenantScope()->pluck('fleet')->all());
        $this->assertStringContainsString('only crew whose fleet is exactly that', implode("\n", $report->notes));

        $todos = Todo::withoutTenantScope()->orderBy('description')->get();
        $this->assertSame(['Renew medical', 'Sign contract'], $todos->pluck('description')->all()); // T-3's user was not imported
        $this->assertSame([false, true], $todos->pluck('is_done')->all());
        $this->assertSame('2024-05-05 05:05:05', $todos[1]->done_at->format('Y-m-d H:i:s'));
    }

    public function test_running_it_again_updates_instead_of_duplicating(): void
    {
        $this->run_();
        $first = $this->counts();
        DB::connection('legacy')->table('tb_user')->where('userID', 'U-CREW1')->update(['first_name' => 'Marie']);

        $report = $this->run_();

        $this->assertSame($first, $this->counts());
        $this->assertSame(0, $report->entities['user']['created']);
        $this->assertSame('Marie', CrewProfile::withoutTenantScope()->where('crew_number', '09977')->value('first_name'));
        $this->assertSame(1, Tenant::where('code', 'OLDCO')->count());
    }

    public function test_a_dry_run_reports_but_writes_nothing(): void
    {
        $before = $this->counts();
        $report = $this->run_(dry: true);

        $this->assertSame($before, $this->counts());
        $this->assertSame(4, $report->entities['user']['created']);
        $this->assertSame([], Storage::disk('local')->allFiles());
        $this->assertStringContainsString('dry run', implode("\n", $report->notes));
    }

    public function test_it_refuses_to_run_when_source_and_target_are_the_same_or_not_what_they_must_be(): void
    {
        $default = config('database.connections.'.config('database.default'));
        config(['database.connections.legacy' => $default]);
        DB::purge('legacy');
        try {
            (new LegacyImporter)->guard();
            $this->fail('same database was accepted');
        } catch (\RuntimeException $e) {
            $this->assertStringContainsString('same one', $e->getMessage());
        }

        // a source that is already a v2 database
        config(['database.connections.legacy' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']]);
        DB::purge('legacy');
        Schema::connection('legacy')->create('tb_user', fn (Blueprint $t) => $t->string('userID'));
        Schema::connection('legacy')->create('tenants', fn (Blueprint $t) => $t->string('id'));
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('does not look like the old Sailix database');
        (new LegacyImporter)->guard();
    }

    public function test_an_unconfigured_source_is_refused(): void
    {
        config(['database.connections.legacy' => ['driver' => 'mysql', 'database' => null]]);
        DB::purge('legacy');
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('not configured');
        (new LegacyImporter)->guard();
    }
}

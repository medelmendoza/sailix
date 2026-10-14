<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\AuditLog;
use App\Models\CrewDocument;
use App\Models\DocumentType;
use App\Support\Tenancy\TenantContext;
use Database\Seeders\CrewPortalDemoSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class DocumentTest extends TestCase
{
    /** @var array<string, string> */
    private array $m = [];

    /** @var array<string, string> document type ids by organization code */
    private array $type = [];

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        config(['sailix.documents.disk' => 'local']);
    }

    private function setUpOrganizations(): void
    {
        foreach (['AAA' => ['adminA', 'crewA', 'crewA2'], 'BBB' => ['adminB', 'crewB']] as $code => $names) {
            $tenant = $this->makeTenant($code);
            foreach ($names as $name) {
                [, $membership] = $this->makeMember($tenant, str_starts_with($name, 'admin') ? Role::TenantAdmin : Role::Crew, $name);
                $this->m[$name] = $membership->id;
            }
            $type = (new DocumentType)->forceFill(['tenant_id' => $tenant->id, 'name' => "Passport $code", 'short_name' => 'PP', 'is_active' => true]);
            $type->save();
            $this->type[$code] = $type->id;
        }
    }

    private function pdf(string $name = 'passport.pdf'): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($name, CrewPortalDemoSeeder::pdf('Test document'));
    }

    private function submit(string $as, array $extra = [], ?UploadedFile $file = null)
    {
        return $this->post('/api/v1/documents', $extra + [
            'document_type_id' => $this->type['AAA'], 'number' => 'P123', 'issued_on' => '2024-01-10', 'expires_on' => '2030-01-10',
            'file' => $file ?? $this->pdf(),
        ], $this->as($as) + ['Accept' => 'application/json']);
    }

    public function test_a_member_submits_a_document_and_it_waits_for_the_agency(): void
    {
        $this->setUpOrganizations();
        $r = $this->submit('crewA')->assertCreated()->assertJsonPath('data.status', 'pending')->assertJsonPath('data.type.name', 'Passport AAA');

        $row = CrewDocument::withoutTenantScope()->findOrFail($r->json('data.id'));
        $this->assertSame($this->m['crewA'], $row->membership_id);
        $this->assertSame('application/pdf', $row->file_mime);
        Storage::disk('local')->assertExists($row->file_path);
        $this->assertStringStartsWith('documents/'.$row->tenant_id.'/', $row->file_path);
        $this->assertDoesNotMatchRegularExpression('/passport/i', $row->file_path); // the stored name is random, not the client's

        $this->assertSame([], $this->getJson('/api/v1/documents', $this->as('crewA'))->json('data')); // not approved yet
        $this->assertCount(1, $this->getJson('/api/v1/documents?status=review', $this->as('crewA'))->json('data'));
    }

    public function test_owner_status_and_review_fields_come_from_the_session_never_the_request(): void
    {
        $this->setUpOrganizations();
        $r = $this->submit('crewA', ['membership_id' => $this->m['crewA2'], 'status' => 'approved', 'tenant_id' => 'x', 'reviewed_at' => now()->toIso8601String()])->assertCreated();

        $row = CrewDocument::withoutTenantScope()->findOrFail($r->json('data.id'));
        $this->assertSame($this->m['crewA'], $row->membership_id);
        $this->assertSame('pending', $row->status);
        $this->assertNull($row->reviewed_at);
    }

    public function test_only_pdf_jpeg_and_png_judged_by_content_are_accepted_and_size_is_limited(): void
    {
        $this->setUpOrganizations();

        // REAL uploads (Laravel's fake files take their type from the file NAME, which would hide the content check)
        $this->submit('crewA', [], $this->realUpload('evil.pdf', '<?php echo 1;'))->assertStatus(422);
        $this->submit('crewA', [], $this->realUpload('page.pdf', '<html><script>1</script></html>'))->assertStatus(422);
        $this->submit('crewA', [], $this->realUpload('photo.png', '#!/bin/sh'."\n".'rm -rf /'))->assertStatus(422);
        $this->submit('crewA', [], UploadedFile::fake()->create('big.pdf', 11 * 1024, 'application/pdf'))->assertStatus(422); // default limit is 10 MB
        $this->assertSame(0, CrewDocument::withoutTenantScope()->count());

        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
        $this->submit('crewA', [], UploadedFile::fake()->createWithContent('scan.png', $png))->assertCreated()->assertJsonPath('data.file.type', 'image/png');
    }

    public function test_the_document_type_must_be_an_active_type_of_the_own_organization(): void
    {
        $this->setUpOrganizations();

        $this->submit('crewA', ['document_type_id' => $this->type['BBB']])->assertStatus(422)->assertJsonPath('code', 'invalid_document_type');
        $this->submit('crewA', ['document_type_id' => '00000000-0000-0000-0000-000000000000'])->assertStatus(422);
        DocumentType::withoutTenantScope()->whereKey($this->type['AAA'])->update(['is_active' => false]);
        $this->submit('crewA')->assertStatus(422)->assertJsonPath('code', 'invalid_document_type');
        $this->assertSame(0, CrewDocument::withoutTenantScope()->count());
    }

    public function test_validation_of_the_fields_and_dates(): void
    {
        $this->setUpOrganizations();

        $this->submit('crewA', ['expires_on' => '2020-01-01', 'issued_on' => '2024-01-10'])->assertStatus(422)->assertJsonValidationErrors('expires_on');
        $this->submit('crewA', ['issued_on' => '10/01/2024'])->assertStatus(422);
        $this->submit('crewA', ['number' => str_repeat('a', 81)])->assertStatus(422);
        $this->post('/api/v1/documents', ['document_type_id' => $this->type['AAA']], $this->as('crewA') + ['Accept' => 'application/json'])->assertStatus(422); // no file
    }

    public function test_the_server_computes_the_expiry_status_and_the_counts(): void
    {
        $this->setUpOrganizations();
        foreach ([['expired', now()->subDay()], ['expiring', now()->addDays(30)], ['valid', now()->addDays(400)], ['none', null]] as [$name, $date]) {
            $id = $this->submit('crewA', ['number' => $name, 'expires_on' => $date?->toDateString(), 'issued_on' => '2000-01-01'])->json('data.id');
            CrewDocument::withoutTenantScope()->whereKey($id)->update(['status' => 'approved']);
        }

        $list = $this->getJson('/api/v1/documents', $this->as('crewA'))->assertOk();
        $by = collect($list->json('data'))->pluck('expiry_status', 'number');
        $this->assertSame(['expired' => 'expired', 'expiring' => 'expiring', 'valid' => 'valid', 'none' => 'none'], $by->all());
        $this->assertSame(['expired' => 1, 'expiring' => 1], $list->json('counts'));
        $this->assertSame('expired', $list->json('data.0.expiry_status')); // soonest expiry first
    }

    public function test_nobody_can_see_or_download_someone_elses_document(): void
    {
        $this->setUpOrganizations();
        $id = $this->submit('crewA')->json('data.id');

        $this->getJson("/api/v1/documents/$id", $this->as('crewA'))->assertOk();
        $this->get("/api/v1/documents/$id/file", $this->as('crewA'))->assertOk()->assertHeader('X-Content-Type-Options', 'nosniff')->assertHeader('Content-Type', 'application/pdf');

        foreach (['crewA2', 'crewB'] as $other) { // a colleague and another organization
            $this->getJson("/api/v1/documents/$id", $this->as($other))->assertNotFound();
            $this->get("/api/v1/documents/$id/file", $this->as($other))->assertNotFound();
            $this->post("/api/v1/documents/$id/resubmit", ['number' => 'hijack'], $this->as($other) + ['Accept' => 'application/json'])->assertNotFound();
        }
        $this->assertSame([], $this->getJson('/api/v1/documents?status=review', $this->as('crewA2'))->json('data'));
        $this->getJson('/api/v1/documents/not-an-id', $this->as('crewA'))->assertNotFound();
        $this->app['auth']->forgetGuards();
        $this->getJson("/api/v1/documents/$id")->assertUnauthorized();
    }

    public function test_an_administrator_approves_or_rejects_only_pending_documents_of_their_own_organization(): void
    {
        $this->setUpOrganizations();
        $a = $this->submit('crewA')->json('data.id');
        $b = $this->submit('crewA', ['number' => 'second'])->json('data.id');

        $this->postJson("/api/v1/tenant/documents/$a/approve", [], $this->as('adminA'))->assertOk()->assertJsonPath('data.status', 'approved');
        $this->postJson("/api/v1/tenant/documents/$a/approve", [], $this->as('adminA'))->assertStatus(409)->assertJsonPath('code', 'not_pending');
        $this->postJson("/api/v1/tenant/documents/$b/reject", [], $this->as('adminA'))->assertStatus(422); // a reason is required
        $this->postJson("/api/v1/tenant/documents/$b/reject", ['reason' => 'Scan is cut off'], $this->as('adminA'))->assertOk()->assertJsonPath('data.status', 'rejected');

        $row = CrewDocument::withoutTenantScope()->findOrFail($b);
        $this->assertSame($this->m['adminA'], $row->reviewed_by_membership_id);
        $mine = collect($this->getJson('/api/v1/documents?status=review', $this->as('crewA'))->json('data'))->first();
        $this->assertSame('Scan is cut off', $mine['rejection_reason']); // the member sees why

        // another organization's administrator can neither list nor act on it
        $c = $this->submit('crewA', ['number' => 'third'])->json('data.id');
        $this->postJson("/api/v1/tenant/documents/$c/approve", [], $this->as('adminB'))->assertNotFound();
        $this->get("/api/v1/tenant/documents/$c/file", $this->as('adminB'))->assertNotFound();
        $this->assertSame([], $this->getJson('/api/v1/tenant/documents', $this->as('adminB'))->json('data'));
        $this->assertSame('pending', CrewDocument::withoutTenantScope()->findOrFail($c)->status);
    }

    public function test_crew_cannot_review_or_manage_types(): void
    {
        $this->setUpOrganizations();
        $id = $this->submit('crewA')->json('data.id');

        $this->postJson("/api/v1/tenant/documents/$id/approve", [], $this->as('crewA'))->assertForbidden();
        $this->getJson('/api/v1/tenant/documents', $this->as('crewA'))->assertForbidden();
        $this->postJson('/api/v1/tenant/document-types', ['name' => 'X'], $this->as('crewA'))->assertForbidden();
        $this->assertSame('pending', CrewDocument::withoutTenantScope()->findOrFail($id)->status);
    }

    public function test_a_rejected_document_can_be_corrected_and_resubmitted_but_an_approved_one_is_final(): void
    {
        $this->setUpOrganizations();
        $id = $this->submit('crewA')->json('data.id');
        $this->postJson("/api/v1/tenant/documents/$id/reject", ['reason' => 'Blurry'], $this->as('adminA'))->assertOk();
        $old = CrewDocument::withoutTenantScope()->findOrFail($id)->file_path;

        $r = $this->post("/api/v1/documents/$id/resubmit", ['number' => 'FIXED', 'file' => $this->pdf('better.pdf')], $this->as('crewA') + ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('data.status', 'pending')->assertJsonPath('data.number', 'FIXED')->assertJsonPath('data.rejection_reason', null);
        $row = CrewDocument::withoutTenantScope()->findOrFail($id);
        $this->assertNull($row->reviewed_at);
        Storage::disk('local')->assertMissing($old); // the replaced file is removed
        Storage::disk('local')->assertExists($row->file_path);

        $this->postJson("/api/v1/tenant/documents/$id/approve", [], $this->as('adminA'))->assertOk();
        $this->post("/api/v1/documents/$id/resubmit", ['number' => 'late edit'], $this->as('crewA') + ['Accept' => 'application/json'])->assertStatus(409)->assertJsonPath('code', 'document_approved');
        $this->assertSame('FIXED', CrewDocument::withoutTenantScope()->findOrFail($id)->number);
    }

    public function test_document_types_are_managed_per_organization(): void
    {
        $this->setUpOrganizations();

        $new = $this->postJson('/api/v1/tenant/document-types', ['name' => '  Visa  ', 'short_name' => 'VISA'], $this->as('adminA'))->assertCreated()->assertJsonPath('data.name', 'Visa');
        $this->postJson('/api/v1/tenant/document-types', ['name' => 'Visa'], $this->as('adminA'))->assertStatus(409)->assertJsonPath('code', 'document_type_exists');
        $this->postJson('/api/v1/tenant/document-types', ['name' => 'Visa'], $this->as('adminB'))->assertCreated(); // the same name in another organization is fine

        $names = array_column($this->getJson('/api/v1/document-types', $this->as('crewA'))->json('data'), 'name');
        $this->assertEqualsCanonicalizing(['Passport AAA', 'Visa'], $names);

        $this->patchJson('/api/v1/tenant/document-types/'.$new->json('data.id'), ['is_active' => false], $this->as('adminA'))->assertOk();
        $this->assertNotContains('Visa', array_column($this->getJson('/api/v1/document-types', $this->as('crewA'))->json('data'), 'name'));
        $this->patchJson('/api/v1/tenant/document-types/'.$new->json('data.id'), ['name' => 'x'], $this->as('adminB'))->assertNotFound();

        $this->submit('crewA')->assertCreated();
        $this->deleteJson('/api/v1/tenant/document-types/'.$this->type['AAA'], [], $this->as('adminA'))->assertStatus(409)->assertJsonPath('code', 'document_type_in_use');
        $this->deleteJson('/api/v1/tenant/document-types/'.$new->json('data.id'), [], $this->as('adminA'))->assertNoContent();
    }

    public function test_the_audit_trail_records_that_it_happened_but_not_the_reason_or_number(): void
    {
        $this->setUpOrganizations();
        $id = $this->submit('crewA', ['number' => 'SECRETNUMBER'])->json('data.id');
        $this->postJson("/api/v1/tenant/documents/$id/reject", ['reason' => 'private reason text'], $this->as('adminA'))->assertOk();

        $logs = AuditLog::query()->tap(fn () => app(TenantContext::class)->markPlatform())->where('action', 'like', 'document.%')->get();
        $this->assertEqualsCanonicalizing(['document.submitted', 'document.rejected'], $logs->pluck('action')->all());
        $this->assertStringNotContainsString('SECRETNUMBER', json_encode($logs->toArray()));
        $this->assertStringNotContainsString('private reason', json_encode($logs->toArray()));
    }
}

<?php

namespace Tests\Feature;

use App\Enums\ModuleStatus;
use App\Enums\Role;
use App\Models\AuditLog;
use App\Models\CallItReport;
use App\Models\Tenant;
use App\Models\TenantModule;
use App\Modules\Module;
use App\Support\Tenancy\TenantContext;
use Database\Seeders\CrewPortalDemoSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CallItTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        config(['sailix.documents.disk' => 'local']);
    }

    private function setUpOrganizations(bool $callItOn = true): void
    {
        foreach (['AAA' => ['adminA', 'crewA', 'crewA2'], 'BBB' => ['adminB', 'crewB']] as $code => $names) {
            $tenant = $this->makeTenant($code);
            foreach ($names as $name) {
                $this->makeMember($tenant, str_starts_with($name, 'admin') ? Role::TenantAdmin : Role::Crew, $name);
            }
            if ($callItOn) {
                (new TenantModule)->forceFill(['tenant_id' => $tenant->id, 'module' => Module::CallIt, 'status' => ModuleStatus::Enabled])->save();
            }
        }
    }

    private function complete(array $over = []): array
    {
        return $over + [
            'classification' => 'unsafe_conditions', 'sub_classification' => 'equipment', 'location' => 'main_deck',
            'vessel' => 'MV Test', 'details' => 'Oil leak under the winch.', 'intervened' => false,
        ];
    }

    private function make(string $as, array $body, bool $submit = false)
    {
        return $this->postJson('/api/v1/callit/reports', $body + ($submit ? ['submit' => true] : []), $this->as($as));
    }

    public function test_only_organizations_with_the_module_on_can_use_it(): void
    {
        $this->setUpOrganizations(false);
        $this->getJson('/api/v1/callit/stats', $this->as('crewA'))->assertForbidden()->assertJsonPath('code', 'module_disabled');
        $this->make('crewA', $this->complete())->assertForbidden();

        TenantModule::withoutTenantScope()->where('module', 'callit')->get(); // none yet
        (new TenantModule)->forceFill(['tenant_id' => Tenant::where('code', 'AAA')->value('id'), 'module' => Module::CallIt, 'status' => ModuleStatus::Enabled])->save();
        $this->getJson('/api/v1/callit/stats', $this->as('crewA'))->assertOk();
        $this->getJson('/api/v1/callit/stats', $this->as('crewB'))->assertForbidden(); // the other organization still has it off
    }

    public function test_a_draft_can_be_half_written_and_is_private_to_the_reporter(): void
    {
        $this->setUpOrganizations();
        $id = $this->make('crewA', ['details' => 'Just a note'])->assertCreated()->assertJsonPath('data.status', 'draft')->json('data.id');

        $this->getJson("/api/v1/callit/reports/$id", $this->as('crewA'))->assertOk();
        foreach (['crewA2', 'crewB'] as $other) {
            $this->getJson("/api/v1/callit/reports/$id", $this->as($other))->assertNotFound();
        }
        $this->assertSame([], $this->getJson('/api/v1/tenant/callit/reports', $this->as('adminA'))->json('data')); // the administrator does not see drafts
        $this->getJson("/api/v1/tenant/callit/reports/$id/file", $this->as('adminA'))->assertNotFound();
    }

    public function test_sending_needs_a_complete_report_and_reports_the_missing_fields(): void
    {
        $this->setUpOrganizations();

        $this->make('crewA', ['details' => 'x'], true)->assertStatus(422)->assertJsonValidationErrors(['classification', 'sub_classification', 'location', 'vessel']);
        $this->make('crewA', $this->complete(['location' => 'others']), true)->assertStatus(422)->assertJsonValidationErrors('location_other');
        $this->make('crewA', $this->complete(['intervened' => true]), true)->assertStatus(422)->assertJsonValidationErrors('intervention_details');
        $this->make('crewA', $this->complete(['classification' => 'made_up']))->assertStatus(422);
        $this->make('crewA', $this->complete(['details' => str_repeat('a', 2001)]))->assertStatus(422);
        $this->assertSame(0, CallItReport::withoutTenantScope()->where('status', 'submitted')->count());

        $this->make('crewA', $this->complete(['location' => 'others', 'location_other' => 'Gangway', 'intervened' => true, 'intervention_details' => 'Stopped the work']), true)
            ->assertCreated()->assertJsonPath('data.status', 'submitted');
    }

    public function test_a_draft_is_finished_and_sent_with_just_submit_and_then_it_is_locked(): void
    {
        $this->setUpOrganizations();
        $id = $this->make('crewA', $this->complete())->json('data.id');

        $this->patchJson("/api/v1/callit/reports/$id", ['details' => 'Updated text'], $this->as('crewA'))->assertOk()->assertJsonPath('data.details', 'Updated text');
        $this->patchJson("/api/v1/callit/reports/$id", ['submit' => true], $this->as('crewA'))->assertOk()->assertJsonPath('data.status', 'submitted');
        $this->assertNotNull(CallItReport::withoutTenantScope()->findOrFail($id)->submitted_at);

        $this->patchJson("/api/v1/callit/reports/$id", ['details' => 'late edit'], $this->as('crewA'))->assertStatus(409)->assertJsonPath('code', 'report_not_draft');
        $this->deleteJson("/api/v1/callit/reports/$id", [], $this->as('crewA'))->assertStatus(409);
        $this->assertSame('Updated text', CallItReport::withoutTenantScope()->findOrFail($id)->details);
    }

    public function test_switching_off_the_intervention_or_other_location_clears_their_text(): void
    {
        $this->setUpOrganizations();
        $id = $this->make('crewA', $this->complete(['location' => 'others', 'location_other' => 'Gangway', 'intervened' => true, 'intervention_details' => 'Stopped it']))->json('data.id');

        $r = $this->patchJson("/api/v1/callit/reports/$id", ['location' => 'main_deck', 'intervened' => false], $this->as('crewA'))->assertOk();
        $this->assertNull($r->json('data.location_other'));
        $this->assertNull($r->json('data.intervention_details'));
    }

    public function test_reporter_organization_and_status_come_from_the_session_never_the_body(): void
    {
        $this->setUpOrganizations();
        $r = $this->make('crewA', $this->complete(['membership_id' => 'x', 'tenant_id' => 'x', 'status' => 'reviewed', 'reviewed_at' => now()->toIso8601String()]))->assertCreated();

        $row = CallItReport::withoutTenantScope()->findOrFail($r->json('data.id'));
        $this->assertSame('draft', $row->status);
        $this->assertNull($row->reviewed_at);
        $this->assertNotSame('x', $row->membership_id);
        $this->assertNotSame('x', $row->tenant_id);
    }

    public function test_the_administrator_sees_sent_reports_of_their_own_organization_and_marks_them_reviewed(): void
    {
        $this->setUpOrganizations();
        $a = $this->make('crewA', $this->complete(), true)->json('data.id');
        $this->make('crewB', $this->complete(['details' => 'Other company']), true)->assertCreated();

        $list = $this->getJson('/api/v1/tenant/callit/reports', $this->as('adminA'))->assertOk();
        $this->assertSame([$a], array_column($list->json('data'), 'id'));
        $this->assertSame('crewA', $list->json('data.0.reporter.user.username'));

        $this->postJson("/api/v1/tenant/callit/reports/$a/review", [], $this->as('adminB'))->assertNotFound();
        $this->postJson("/api/v1/tenant/callit/reports/$a/review", [], $this->as('adminA'))->assertOk()->assertJsonPath('data.status', 'reviewed');
        $this->postJson("/api/v1/tenant/callit/reports/$a/review", [], $this->as('adminA'))->assertStatus(409)->assertJsonPath('code', 'not_submitted');
        $this->assertSame('reviewed', CallItReport::withoutTenantScope()->findOrFail($a)->status);
    }

    public function test_crew_cannot_read_the_administrator_list_or_review(): void
    {
        $this->setUpOrganizations();
        $id = $this->make('crewA', $this->complete(), true)->json('data.id');

        $this->getJson('/api/v1/tenant/callit/reports', $this->as('crewA'))->assertForbidden();
        $this->postJson("/api/v1/tenant/callit/reports/$id/review", [], $this->as('crewA'))->assertForbidden();
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/callit/reports')->assertUnauthorized();
    }

    public function test_a_file_is_checked_by_content_attached_to_a_draft_only_and_read_by_its_owner_and_the_administrator(): void
    {
        $this->setUpOrganizations();
        $id = $this->make('crewA', $this->complete())->json('data.id');
        $url = "/api/v1/callit/reports/$id/file";
        $h = fn (string $who) => $this->as($who) + ['Accept' => 'application/json'];

        $this->post($url, ['file' => $this->realUpload('evil.pdf', '<?php echo 1;')], $h('crewA'))->assertStatus(422);
        $this->post($url, ['file' => UploadedFile::fake()->createWithContent('photo.pdf', CrewPortalDemoSeeder::pdf('Evidence'))], $h('crewA'))
            ->assertOk()->assertJsonPath('data.file.type', 'application/pdf');
        $path = CallItReport::withoutTenantScope()->findOrFail($id)->file_path;
        Storage::disk('local')->assertExists($path);

        $this->get($url, $this->as('crewA'))->assertOk()->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->get($url, $this->as('crewA2'))->assertNotFound();

        // replacing removes the old file; detaching removes it too
        $this->post($url, ['file' => UploadedFile::fake()->createWithContent('b.pdf', CrewPortalDemoSeeder::pdf('Second'))], $h('crewA'))->assertOk();
        Storage::disk('local')->assertMissing($path);
        $this->deleteJson($url, [], $this->as('crewA'))->assertOk()->assertJsonPath('data.file', null);

        // once sent, a file cannot be changed, but the administrator can read it
        $this->post($url, ['file' => UploadedFile::fake()->createWithContent('c.pdf', CrewPortalDemoSeeder::pdf('Third'))], $h('crewA'))->assertOk();
        $this->patchJson("/api/v1/callit/reports/$id", ['submit' => true], $this->as('crewA'))->assertOk();
        $this->post($url, ['file' => UploadedFile::fake()->createWithContent('d.pdf', CrewPortalDemoSeeder::pdf('Fourth'))], $h('crewA'))->assertStatus(409);
        $this->get("/api/v1/tenant/callit/reports/$id/file", $this->as('adminA'))->assertOk();
        $this->get("/api/v1/tenant/callit/reports/$id/file", $this->as('adminB'))->assertNotFound();
    }

    public function test_deleting_a_draft_removes_its_file(): void
    {
        $this->setUpOrganizations();
        $id = $this->make('crewA', $this->complete())->json('data.id');
        $this->post("/api/v1/callit/reports/$id/file", ['file' => UploadedFile::fake()->createWithContent('a.pdf', CrewPortalDemoSeeder::pdf('x'))], $this->as('crewA') + ['Accept' => 'application/json'])->assertOk();
        $path = CallItReport::withoutTenantScope()->findOrFail($id)->file_path;

        $this->deleteJson("/api/v1/callit/reports/$id", [], $this->as('crewA'))->assertNoContent();
        $this->assertSame(0, CallItReport::withoutTenantScope()->count());
        Storage::disk('local')->assertMissing($path);
    }

    public function test_stats_count_only_sent_reports_and_give_milestones(): void
    {
        $this->setUpOrganizations();
        $this->make('crewA', $this->complete()); // a draft does not count
        $zero = $this->getJson('/api/v1/callit/stats', $this->as('crewA'))->assertOk();
        $this->assertSame(0, $zero->json('data.reports_made'));
        $this->assertSame(1, $zero->json('data.next_badge'));

        $this->make('crewA', $this->complete(), true)->assertCreated();
        $one = $this->getJson('/api/v1/callit/stats', $this->as('crewA'));
        $this->assertSame(1, $one->json('data.reports_made'));
        $this->assertSame([['reports' => 1, 'label' => 'First report']], $one->json('data.badges'));
        $this->assertSame(10, $one->json('data.next_badge'));
        $this->assertSame(0, $this->getJson('/api/v1/callit/stats', $this->as('crewA2'))->json('data.reports_made')); // per member
    }

    public function test_malformed_ids_are_not_found_and_the_audit_trail_never_holds_the_text(): void
    {
        $this->setUpOrganizations();
        foreach (['not-an-id', '..%2f..'] as $bad) {
            $this->getJson("/api/v1/callit/reports/$bad", $this->as('crewA'))->assertNotFound();
        }
        $id = $this->make('crewA', $this->complete(['details' => 'SECRETDETAILS']), true)->json('data.id');
        $this->postJson("/api/v1/tenant/callit/reports/$id/review", [], $this->as('adminA'))->assertOk();

        $logs = AuditLog::query()->tap(fn () => app(TenantContext::class)->markPlatform())->where('action', 'like', 'callit.%')->get();
        $this->assertEqualsCanonicalizing(['callit.submitted', 'callit.reviewed'], $logs->pluck('action')->all());
        $this->assertStringNotContainsString('SECRETDETAILS', json_encode($logs->toArray()));
    }
}

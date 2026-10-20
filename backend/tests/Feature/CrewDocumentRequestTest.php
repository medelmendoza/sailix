<?php

namespace Tests\Feature;

use App\Enums\MembershipStatus;
use App\Enums\Role;
use App\Models\AuditLog;
use App\Models\CrewDocument;
use App\Models\DocumentAssignment;
use App\Models\DocumentType;
use App\Models\Membership;
use App\Support\Tenancy\TenantContext;
use Database\Seeders\CrewPortalDemoSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CrewDocumentRequestTest extends TestCase
{
    /** @var array<string, string> membership ids by username */
    private array $m = [];

    /** @var array<string, string> document type ids by key */
    private array $t = [];

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        config(['sailix.documents.disk' => 'local']);

        $a = $this->makeTenant('AAA');
        $b = $this->makeTenant('BBB');
        foreach ([[$a, Role::TenantAdmin, 'adminA'], [$a, Role::Crew, 'crewA'], [$b, Role::TenantAdmin, 'adminB'], [$b, Role::Crew, 'crewB']] as [$tenant, $role, $name]) {
            [, $membership] = $this->makeMember($tenant, $role, $name);
            $this->m[$name] = $membership->id;
        }
        foreach ([['passport', $a, 'Passport', true], ['visa', $a, 'US Visa', true], ['cop', $a, 'Basic Training COP', true], ['old', $a, 'Retired type', false], ['other', $b, 'Passport', true]] as [$key, $tenant, $name, $active]) {
            $type = (new DocumentType)->forceFill(['tenant_id' => $tenant->id, 'name' => $name, 'short_name' => null, 'is_active' => $active]);
            $type->save();
            $this->t[$key] = $type->id;
        }
    }

    private function document(string $type, string $status, ?string $expires, string $submitted = '2026-01-01'): CrewDocument
    {
        $doc = (new CrewDocument)->forceFill([
            'tenant_id' => Membership::withoutTenantScope()->findOrFail($this->m['crewA'])->tenant_id, 'membership_id' => $this->m['crewA'],
            'document_type_id' => $this->t[$type], 'status' => $status, 'number' => 'N1', 'expires_on' => $expires,
            'file_disk' => 'local', 'file_path' => 'x', 'file_original_name' => 'x.pdf', 'file_mime' => 'application/pdf', 'file_size' => 1,
            'submitted_at' => $submitted,
        ]);
        $doc->save();

        return $doc;
    }

    private function rows(string $as = 'adminA')
    {
        return collect($this->getJson('/api/v1/tenant/crew/'.$this->m['crewA'].'/documents', $this->as($as))->assertOk()->json('data'))->keyBy('type.name');
    }

    private function ask(string $type, string $as = 'adminA', string $member = 'crewA')
    {
        return $this->putJson('/api/v1/tenant/crew/'.$this->m[$member].'/document-requests/'.$this->t[$type], [], $this->as($as));
    }

    public function test_it_lists_every_active_kind_with_what_the_member_has_and_its_state(): void
    {
        $this->document('passport', CrewDocument::APPROVED, now()->addYears(3)->toDateString());
        $this->document('visa', CrewDocument::APPROVED, now()->addDays(30)->toDateString());
        $this->document('cop', CrewDocument::APPROVED, now()->subDay()->toDateString());

        $rows = $this->rows();

        $this->assertSame(['Basic Training COP', 'Passport', 'US Visa'], $rows->keys()->sort()->values()->all()); // not the retired type, not another organization's
        $this->assertSame('valid', $rows['Passport']['state']);
        $this->assertSame('expiring', $rows['US Visa']['state']);
        $this->assertSame('expired', $rows['Basic Training COP']['state']);
        $this->assertFalse($rows['Passport']['requested']);
    }

    public function test_a_kind_without_a_document_is_missing_and_waiting_or_sent_back_ones_say_so(): void
    {
        $this->document('visa', CrewDocument::PENDING, '2030-01-01');
        $this->document('cop', CrewDocument::REJECTED, '2030-01-01');

        $rows = $this->rows();
        $this->assertSame('missing', $rows['Passport']['state']);
        $this->assertNull($rows['Passport']['document']);
        $this->assertSame('pending', $rows['US Visa']['state']);
        $this->assertSame('rejected', $rows['Basic Training COP']['state']);
    }

    public function test_the_approved_document_that_stays_valid_longest_counts_and_no_expiry_outlasts_any_date(): void
    {
        $this->document('passport', CrewDocument::APPROVED, now()->subYear()->toDateString());
        $this->document('passport', CrewDocument::APPROVED, now()->addYears(5)->toDateString());
        $this->document('visa', CrewDocument::APPROVED, now()->addDays(5)->toDateString());
        $this->document('visa', CrewDocument::APPROVED, null);

        $rows = $this->rows();
        $this->assertSame('valid', $rows['Passport']['state']);
        $this->assertSame('none', $rows['US Visa']['state']); // no expiry date: never runs out
    }

    public function test_an_administrator_asks_for_a_document_and_can_take_the_request_back(): void
    {
        $this->ask('cop')->assertCreated()->assertJsonPath('data.requested', true);
        $this->assertTrue($this->rows()['Basic Training COP']['requested']);
        $this->ask('cop')->assertOk(); // asking again changes nothing
        $this->assertSame(1, DocumentAssignment::withoutTenantScope()->count());

        $this->deleteJson('/api/v1/tenant/crew/'.$this->m['crewA'].'/document-requests/'.$this->t['cop'], [], $this->as('adminA'))->assertNoContent();
        $this->assertFalse($this->rows()['Basic Training COP']['requested']);
        $this->deleteJson('/api/v1/tenant/crew/'.$this->m['crewA'].'/document-requests/'.$this->t['cop'], [], $this->as('adminA'))->assertNoContent(); // already gone: still fine

        $audit = AuditLog::query()->tap(fn () => app(TenantContext::class)->markPlatform())->whereIn('action', ['document_request.created', 'document_request.removed'])->pluck('action')->all();
        $this->assertEqualsCanonicalizing(['document_request.created', 'document_request.removed'], $audit);
    }

    public function test_the_member_submitting_that_kind_closes_the_request_and_it_can_be_asked_again(): void
    {
        $this->ask('passport')->assertCreated();

        $this->post('/api/v1/documents', [
            'document_type_id' => $this->t['passport'], 'number' => 'P1', 'issued_on' => '2024-01-10', 'expires_on' => '2030-01-10',
            'file' => UploadedFile::fake()->createWithContent('p.pdf', CrewPortalDemoSeeder::pdf('Test document')),
        ], $this->as('crewA') + ['Accept' => 'application/json'])->assertCreated();

        $this->assertFalse($this->rows()['Passport']['requested']); // answered
        $this->ask('passport')->assertCreated(); // an expiring one can be asked for again
        $this->assertTrue($this->rows()['Passport']['requested']);
    }

    public function test_sending_a_rejected_document_again_also_closes_the_request(): void
    {
        $rejected = $this->document('cop', CrewDocument::REJECTED, '2030-01-01');
        $this->ask('cop')->assertCreated();

        $this->post('/api/v1/documents/'.$rejected->id.'/resubmit', [
            'file' => UploadedFile::fake()->createWithContent('c.pdf', CrewPortalDemoSeeder::pdf('Test document')),
        ], $this->as('crewA') + ['Accept' => 'application/json'])->assertOk();

        $this->assertFalse($this->rows()['Basic Training COP']['requested']);
    }

    public function test_only_documents_managers_use_it_and_organizations_stay_apart(): void
    {
        $this->getJson('/api/v1/tenant/crew/'.$this->m['crewA'].'/documents', $this->as('crewA'))->assertForbidden();
        $this->ask('cop', 'crewA')->assertForbidden();

        $this->getJson('/api/v1/tenant/crew/'.$this->m['crewB'].'/documents', $this->as('adminA'))->assertNotFound();
        $this->ask('cop', 'adminA', 'crewB')->assertNotFound();
        $this->ask('other')->assertNotFound(); // another organization's kind
        $this->getJson('/api/v1/tenant/crew/'.$this->m['adminA'].'/documents', $this->as('adminA'))->assertNotFound(); // administrators are not crew
    }

    public function test_it_refuses_a_retired_kind_an_inactive_member_and_a_made_up_id(): void
    {
        $this->ask('old')->assertNotFound();
        $this->putJson('/api/v1/tenant/crew/'.$this->m['crewA'].'/document-requests/not-an-id', [], $this->as('adminA'))->assertNotFound();

        Membership::withoutTenantScope()->whereKey($this->m['crewA'])->update(['status' => MembershipStatus::Suspended]);
        $this->ask('cop')->assertStatus(409)->assertJsonPath('code', 'not_active');
        $this->assertSame(0, DocumentAssignment::withoutTenantScope()->count());
    }
}

<?php

namespace Tests\Feature;

use App\Enums\MembershipStatus;
use App\Enums\Role;
use App\Models\AuditLog;
use App\Models\CrewProfile;
use App\Models\Membership;
use App\Support\Tenancy\TenantContext;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class CrewTest extends TestCase
{
    /** @var array<string, string> membership ids by username */
    private array $m = [];

    protected function setUp(): void
    {
        parent::setUp();
        $a = $this->makeTenant('AAA');
        $b = $this->makeTenant('BBB');
        $people = [
            [$a, Role::TenantAdmin, 'adminA', null], [$a, Role::Crew, 'bustamante', ['Jaycob', 'Bustamante', '09977', 'AB', 'Fleet B']],
            [$a, Role::Crew, 'gatdula', ['Gian', 'Gatdula', '09988', 'OS', null]], [$a, Role::Crew, 'mendoza', ['Medel', 'Mendoza', '09989', 'MSTR', 'Fleet B']],
            [$b, Role::TenantAdmin, 'adminB', null], [$b, Role::Crew, 'crewB', ['Zed', 'Other', '09977', 'AB', 'Fleet X']],
        ];
        foreach ($people as [$t, $role, $name, $profile]) {
            [, $membership] = $this->makeMember($t, $role, $name);
            $this->m[$name] = $membership->id;
            if ($profile) {
                [$first, $last, $number, $rank, $fleet] = $profile;
                (new CrewProfile)->forceFill([
                    'tenant_id' => $t->getKey(), 'membership_id' => $membership->id, 'first_name' => $first, 'last_name' => $last,
                    'crew_number' => $number, 'rank' => $rank, 'fleet' => $fleet,
                ])->save();
            }
        }
    }

    /** @return Collection<int, AuditLog> */
    private function auditOf(string $action)
    {
        return AuditLog::query()->tap(fn () => app(TenantContext::class)->markPlatform())->where('action', $action)->get();
    }

    public function test_the_list_shows_only_this_organizations_crew_sorted_by_name_and_without_birthdays(): void
    {
        $r = $this->getJson('/api/v1/tenant/crew', $this->as('adminA'))->assertOk();

        $this->assertSame(['Bustamante', 'Gatdula', 'Mendoza'], array_column($r->json('data'), 'last_name')); // no admin, no other organization
        $this->assertSame(['09977', '09988', '09989'], array_column($r->json('data'), 'crew_number'));
        $this->assertArrayNotHasKey('birthday', $r->json('data.0'));
    }

    public function test_it_searches_by_last_name_first_name_and_crew_number_and_treats_wildcards_as_text(): void
    {
        $names = fn (string $query) => array_column($this->getJson("/api/v1/tenant/crew?$query", $this->as('adminA'))->assertOk()->json('data'), 'last_name');

        $this->assertSame(['Gatdula'], $names('filter[last_name]=gat'));
        $this->assertSame(['Mendoza'], $names('filter[first_name]=med'));
        $this->assertSame(['Bustamante'], $names('filter[crew_number]=09977'));
        $this->assertSame([], $names('filter[last_name]='.urlencode('%')));
        $this->assertSame(['Gatdula'], $names('filter[last_name]=gat&filter[first_name]=gian'));
    }

    public function test_crew_cannot_use_it_and_an_organization_never_sees_anothers_crew(): void
    {
        $this->getJson('/api/v1/tenant/crew', $this->as('bustamante'))->assertForbidden();
        $this->getJson('/api/v1/tenant/crew/'.$this->m['crewB'], $this->as('adminA'))->assertNotFound();
        $this->patchJson('/api/v1/tenant/crew/'.$this->m['crewB'], ['rank' => 'CE'], $this->as('adminA'))->assertNotFound();
        $this->postJson('/api/v1/tenant/crew/'.$this->m['crewB'].'/password-reset', [], $this->as('adminA'))->assertNotFound();
    }

    public function test_one_member_shows_the_full_record_including_the_birthday(): void
    {
        $this->patchJson('/api/v1/tenant/crew/'.$this->m['bustamante'], ['birthday' => '1990-05-04'], $this->as('adminA'))->assertOk();

        $r = $this->getJson('/api/v1/tenant/crew/'.$this->m['bustamante'], $this->as('adminA'))->assertOk();
        $this->assertSame('1990-05-04', $r->json('data.birthday'));
        $this->assertSame('bustamante', $r->json('data.username'));
        $this->assertSame('Fleet B', $r->json('data.fleet'));
    }

    public function test_an_administrator_is_not_a_crew_record(): void
    {
        $this->getJson('/api/v1/tenant/crew/'.$this->m['adminA'], $this->as('adminA'))->assertNotFound();
    }

    public function test_an_administrator_edits_the_crew_record_and_the_audit_trail_keeps_field_names_only(): void
    {
        $r = $this->patchJson('/api/v1/tenant/crew/'.$this->m['gatdula'], [
            'rank' => ' AB ', 'fleet' => 'Fleet C', 'vessel' => 'MV Aurora', 'employment_status' => 'Onboard',
            'date_arrive' => '2026-01-10', 'date_depart' => '2026-07-10', 'suffix' => 'Jr.', 'middle_name' => '',
        ], $this->as('adminA'))->assertOk();

        $this->assertSame('AB', $r->json('data.rank'));
        $this->assertSame('MV Aurora', $r->json('data.vessel'));
        $this->assertSame('2026-07-10', $r->json('data.date_depart'));
        $this->assertNull($r->json('data.middle_name'));

        $logs = $this->auditOf('crew.updated');
        $this->assertCount(1, $logs);
        $this->assertStringNotContainsString('MV Aurora', json_encode($logs[0]->metadata));
        $this->assertStringContainsString('vessel', json_encode($logs[0]->metadata));
    }

    public function test_it_validates_dates_names_and_a_crew_number_that_is_unique_within_the_organization_only(): void
    {
        $as = $this->as('adminA');
        $patch = fn (array $body) => $this->patchJson('/api/v1/tenant/crew/'.$this->m['gatdula'], $body, $as);

        $patch(['crew_number' => '09977'])->assertStatus(422)->assertJsonValidationErrors('crew_number'); // taken by Bustamante
        $patch(['crew_number' => '09988'])->assertOk(); // its own number again is fine
        $patch(['crew_number' => 'bad number!'])->assertStatus(422);
        $patch(['date_arrive' => '2026-05-10', 'date_depart' => '2026-05-01'])->assertStatus(422);
        $patch(['date_arrive' => '10/05/2026'])->assertStatus(422);
        $patch(['birthday' => '2999-01-01'])->assertStatus(422);
        $patch(['last_name' => ''])->assertStatus(422);
        $patch(['role' => 'tenant_admin', 'status' => 'suspended', 'tenant_id' => 'x'])->assertOk(); // not fields of the record: ignored
        $this->assertSame(Role::Crew, Membership::withoutTenantScope()->findOrFail($this->m['gatdula'])->role);

        $other = $this->patchJson('/api/v1/tenant/crew/'.$this->m['crewB'], ['crew_number' => '09977'], $this->as('adminB')); // another organization may reuse it
        $other->assertOk();
    }

    public function test_the_reset_sends_the_member_the_normal_link_and_never_exposes_a_password(): void
    {
        Mail::fake();
        $r = $this->postJson('/api/v1/tenant/crew/'.$this->m['bustamante'].'/password-reset', [], $this->as('adminA'))->assertStatus(202);

        $this->assertSame(['data' => ['status' => 'sent']], $r->json()); // nothing but the fact that it was sent
        $this->assertCount(1, $this->auditOf('crew.password_reset_sent'));
    }

    public function test_a_suspended_member_cannot_be_sent_a_reset(): void
    {
        Membership::withoutTenantScope()->whereKey($this->m['mendoza'])->update(['status' => MembershipStatus::Suspended]);

        $this->postJson('/api/v1/tenant/crew/'.$this->m['mendoza'].'/password-reset', [], $this->as('adminA'))
            ->assertStatus(409)->assertJsonPath('code', 'not_active');
    }
}

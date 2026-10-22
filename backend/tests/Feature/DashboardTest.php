<?php

namespace Tests\Feature;

use App\Enums\MembershipStatus;
use App\Enums\Role;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    public function test_an_administrator_gets_every_part_in_one_answer(): void
    {
        $tenant = $this->makeTenant('SFAI');
        $this->makeMember($tenant, Role::TenantAdmin, 'admin1');
        $this->makeMember($tenant, Role::Crew, 'crew1');
        $this->makeMember($tenant, Role::Crew, 'crew2', MembershipStatus::Pending);

        $this->getJson('/api/v1/tenant/dashboard', $this->as('admin1'))->assertOk()
            ->assertJsonPath('data.crew.total', 2)
            ->assertJsonPath('data.crew.pending.meta.total', 1)
            ->assertJsonPath('data.crew.pending.meta.per_page', 5)
            ->assertJsonPath('data.documents.pending.meta.total', 0)
            ->assertJsonPath('data.announcements.latest.meta.total', 0)
            ->assertJsonPath('data.deletion_requests.open', 0);
    }

    public function test_a_crew_member_gets_nothing_and_a_switched_off_feature_is_left_out(): void
    {
        $tenant = $this->makeTenant('SFAI');
        $this->makeMember($tenant, Role::TenantAdmin, 'admin1');
        $this->makeMember($tenant, Role::Crew, 'crew1');

        $this->getJson('/api/v1/tenant/dashboard', $this->as('crew1'))->assertForbidden();

        $tenant->forceFill(['disabled_features' => ['announcements', 'crew']])->save();
        $this->getJson('/api/v1/tenant/dashboard', $this->as('admin1'))->assertOk()
            ->assertJsonMissingPath('data.crew')
            ->assertJsonMissingPath('data.announcements')
            ->assertJsonPath('data.documents.pending.meta.total', 0);
    }

    public function test_only_this_organizations_rows_are_counted(): void
    {
        $a = $this->makeTenant('AAA');
        $b = $this->makeTenant('BBB');
        $this->makeMember($a, Role::TenantAdmin, 'adminA');
        $this->makeMember($b, Role::Crew, 'crewB1');
        $this->makeMember($b, Role::Crew, 'crewB2');

        $this->getJson('/api/v1/tenant/dashboard', $this->as('adminA'))->assertOk()->assertJsonPath('data.crew.total', 0);
    }
}

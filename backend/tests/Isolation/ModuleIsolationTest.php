<?php

namespace Tests\Isolation;

use App\Enums\LinkStatus;
use App\Enums\Role;
use App\Models\ExternalIdentity;
use App\Models\Membership;
use App\Models\ModuleLink;
use App\Models\Tenant;
use App\Models\TenantModule;
use App\Models\User;
use App\Modules\Module;
use App\Support\Tenancy\MissingTenantContext;
use App\Support\Tenancy\TenantContext;
use Illuminate\Database\QueryException;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Mandatory conditions 3 (uniqueness, no cross-organization team use) and isolation of the M1 tables.
 * Each database-level rule is tested by inserting directly, so it holds even if application code is wrong.
 */
class ModuleIsolationTest extends TestCase
{
    private Tenant $a;

    private Tenant $b;

    private User $userA;

    private User $userB;

    private Membership $mA;

    private Membership $mB;

    protected function setUp(): void
    {
        parent::setUp();
        $this->a = $this->makeTenant('AAA');
        $this->b = $this->makeTenant('BBB');
        [$this->userA, $this->mA] = $this->makeMember($this->a, Role::Crew, 'userA');
        [$this->userB, $this->mB] = $this->makeMember($this->b, Role::Crew, 'userB');
        $this->provisionModule($this->a, 'TEAM-A');
        $this->provisionModule($this->b, 'TEAM-B');
    }

    private function identity(User $user, string $externalId): ExternalIdentity
    {
        $i = (new ExternalIdentity)->forceFill(['user_id' => $user->getKey(), 'module' => Module::Tala, 'external_user_id' => $externalId]);
        $i->save();

        return $i;
    }

    private function link(string $tenantId, string $membershipId, ExternalIdentity $identity, string $team): ModuleLink
    {
        $l = (new ModuleLink)->forceFill([
            'tenant_id' => $tenantId, 'membership_id' => $membershipId, 'module' => Module::Tala,
            'external_identity_id' => $identity->getKey(), 'external_team_id' => $team, 'status' => LinkStatus::Linked,
        ]);
        $l->save();

        return $l;
    }

    private function inContext(Tenant $t, Membership $m, \Closure $fn): mixed
    {
        return app(TenantContext::class)->runAs($t->id, $m->id, $m->user_id, Role::Crew, $fn);
    }

    // ---- query-level isolation -------------------------------------------------------------------

    public function test_unfiltered_queries_return_only_the_active_tenants_module_rows(): void
    {
        $this->link($this->a->id, $this->mA->id, $this->identity($this->userA, 'ext-A'), 'TEAM-A');
        $this->link($this->b->id, $this->mB->id, $this->identity($this->userB, 'ext-B'), 'TEAM-B');

        $modules = $this->inContext($this->a, $this->mA, fn () => TenantModule::all()->pluck('external_team_id')->all());
        $links = $this->inContext($this->a, $this->mA, fn () => ModuleLink::all()->pluck('external_team_id')->all());

        $this->assertSame(['TEAM-A'], $modules);
        $this->assertSame(['TEAM-A'], $links);
    }

    public function test_module_tables_fail_closed_without_a_tenant_context(): void
    {
        foreach ([TenantModule::class, ModuleLink::class] as $model) {
            try {
                $model::count();
                $this->fail("$model answered without a tenant context");
            } catch (MissingTenantContext) {
                $this->addToAssertionCount(1);
            }
        }
    }

    public function test_tenant_a_cannot_see_or_change_tenant_bs_module_state_over_http(): void
    {
        $this->makeMember($this->a, Role::TenantAdmin, 'adminA');
        $this->app['auth']->forgetGuards();
        $h = $this->bearer($this->tokenFor('adminA'));

        $res = $this->getJson('/api/v1/tenant/modules', $h)->assertOk();
        $this->assertSame('TEAM-A', $res->json('data.0.external_team_id'));
        $this->assertStringNotContainsString('TEAM-B', $res->getContent());

        $this->app['auth']->forgetGuards();
        $this->putJson('/api/v1/tenant/modules/tala', ['enabled' => false], $h)->assertOk();
        $this->assertTrue(TenantModule::withoutTenantScope()->where('tenant_id', $this->b->id)->firstOrFail()->isEnabled(), 'B must be untouched');
    }

    public function test_tenant_a_cannot_learn_bs_team_through_the_mapping_conflict(): void
    {
        // A's admin cannot map teams at all (platform only), so there is no probing oracle for B's team id.
        $this->makeMember($this->a, Role::TenantAdmin, 'adminA');
        $this->app['auth']->forgetGuards();
        $h = $this->bearer($this->tokenFor('adminA'));

        $this->putJson('/api/v1/tenant/modules/tala', ['enabled' => true, 'external_team_id' => 'TEAM-B'], $h)->assertOk()->assertJsonPath('data.external_team_id', 'TEAM-A');
        $this->assertSame('TEAM-A', TenantModule::withoutTenantScope()->where('tenant_id', $this->a->id)->firstOrFail()->external_team_id);
    }

    // ---- database-level: no cross-organization use -----------------------------------------------

    public function test_a_link_cannot_reference_another_tenants_membership(): void
    {
        $identity = $this->identity($this->userB, 'ext-B');

        $this->expectException(QueryException::class);
        // tenant A + team A (valid) but membership of tenant B
        $this->link($this->a->id, $this->mB->id, $identity, 'TEAM-A');
    }

    /** Mandatory condition 3: an organization cannot use another organization's Tala team. */
    public function test_a_link_cannot_use_another_organizations_team(): void
    {
        $identity = $this->identity($this->userA, 'ext-A');

        $this->expectException(QueryException::class);
        // tenant A's own membership but tenant B's mapped team
        $this->link($this->a->id, $this->mA->id, $identity, 'TEAM-B');
    }

    public function test_a_link_cannot_exist_for_a_module_the_tenant_was_never_provisioned(): void
    {
        $c = $this->makeTenant('CCC');
        [$user, $m] = $this->makeMember($c, Role::Crew, 'userC');

        $this->expectException(QueryException::class);
        $this->link($c->id, $m->id, $this->identity($user, 'ext-C'), 'TEAM-C');
    }

    public function test_a_membership_has_one_link_per_module(): void
    {
        $this->link($this->a->id, $this->mA->id, $this->identity($this->userA, 'ext-A'), 'TEAM-A');

        $this->expectException(QueryException::class);
        $second = (new ExternalIdentity)->forceFill(['user_id' => $this->userA->id, 'module' => Module::Tala, 'external_user_id' => 'ext-A2']);
        $second->save();
    }

    public function test_duplicate_link_rows_for_the_same_membership_are_refused_by_the_database(): void
    {
        $i = $this->identity($this->userA, 'ext-A');
        $this->link($this->a->id, $this->mA->id, $i, 'TEAM-A');

        $this->expectException(QueryException::class);
        $this->link($this->a->id, $this->mA->id, $i, 'TEAM-A');
    }

    // ---- external-account uniqueness (mandatory condition 3) -------------------------------------

    public function test_one_external_account_cannot_be_claimed_by_two_sailix_users_even_across_organizations(): void
    {
        $this->identity($this->userA, 'tala-user-42');

        $this->expectException(QueryException::class);
        $this->identity($this->userB, 'tala-user-42'); // different user, different tenant, same Tala account
    }

    public function test_one_external_account_cannot_be_claimed_twice_by_users_of_the_same_organization(): void
    {
        [$other] = $this->makeMember($this->a, Role::Crew, 'userA2');
        $this->identity($this->userA, 'tala-user-42');

        $this->expectException(QueryException::class);
        $this->identity($other, 'tala-user-42');
    }

    public function test_a_sailix_user_has_at_most_one_external_account_per_module(): void
    {
        $this->identity($this->userA, 'tala-user-1');

        $this->expectException(QueryException::class);
        $this->identity($this->userA, 'tala-user-2');
    }

    public function test_external_ids_are_case_sensitive_so_distinct_accounts_never_collide(): void
    {
        $this->identity($this->userA, 'AbC');
        $this->identity($this->userB, 'abc'); // must not raise: different accounts

        $this->assertSame(2, ExternalIdentity::count());
    }

    public function test_the_same_person_may_link_the_same_external_account_in_two_of_their_organizations(): void
    {
        [, $mA2] = [null, $this->makeMembership($this->b, $this->userA, Role::Crew)];
        $identity = $this->identity($this->userA, 'tala-user-9');

        $this->link($this->a->id, $this->mA->id, $identity, 'TEAM-A');
        $this->link($this->b->id, $mA2->id, $identity, 'TEAM-B');

        $this->assertSame(2, ModuleLink::withoutTenantScope()->where('external_identity_id', $identity->id)->count());
    }

    // ---- team mapping uniqueness -----------------------------------------------------------------

    public function test_a_team_cannot_be_mapped_to_two_organizations_even_by_a_direct_insert(): void
    {
        $c = $this->makeTenant('CCC');

        $this->expectException(QueryException::class);
        $this->provisionModule($c, 'TEAM-A');
    }

    public function test_unmapped_rows_do_not_collide(): void
    {
        $c = $this->makeTenant('CCC');
        $d = $this->makeTenant('DDD');
        foreach ([$c, $d] as $t) {
            (new TenantModule)->forceFill(['tenant_id' => $t->id, 'module' => Module::Tala, 'status' => 'disabled', 'external_team_id' => null])->save();
        }

        $this->assertSame(4, TenantModule::withoutTenantScope()->count());
    }

    public function test_a_mapped_team_cannot_change_while_links_reference_it(): void
    {
        $this->link($this->a->id, $this->mA->id, $this->identity($this->userA, 'ext-A'), 'TEAM-A');

        $this->expectException(QueryException::class);
        TenantModule::withoutTenantScope()->where('tenant_id', $this->a->id)->update(['external_team_id' => 'TEAM-A2']); // FK blocks it
    }

    public function test_creating_module_rows_for_another_tenant_inside_a_context_is_refused(): void
    {
        $this->expectException(\LogicException::class);
        $this->inContext($this->a, $this->mA, function () {
            (new TenantModule)->forceFill(['tenant_id' => $this->b->id, 'module' => Module::Tala, 'status' => 'enabled'])->save();
        });
    }

    public function test_guessed_ids_resolve_nothing_across_tenants(): void
    {
        $linkB = $this->link($this->b->id, $this->mB->id, $this->identity($this->userB, 'ext-B'), 'TEAM-B');

        $found = $this->inContext($this->a, $this->mA, fn () => ModuleLink::find($linkB->id));
        $this->assertNull($found);
        $this->assertNull($this->inContext($this->a, $this->mA, fn () => TenantModule::find(Str::uuid()->toString())));
    }
}

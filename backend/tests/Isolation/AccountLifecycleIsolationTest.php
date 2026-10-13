<?php

namespace Tests\Isolation;

use App\Enums\Role;
use App\Models\CrewProfile;
use App\Models\DeletionRequest;
use App\Models\Membership;
use App\Models\Tenant;
use App\Support\Tenancy\MissingTenantContext;
use App\Support\Tenancy\TenantContext;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/** M2 tables: personal data (profiles) and deletion requests are tenant-owned and must never cross organizations. */
class AccountLifecycleIsolationTest extends TestCase
{
    private Tenant $a;

    private Tenant $b;

    private Membership $adminA;

    private Membership $adminB;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
        $this->a = $this->makeTenant('AAA');
        $this->b = $this->makeTenant('BBB');
        [, $this->adminA] = $this->makeMember($this->a, Role::TenantAdmin, 'adminA');
        [, $this->adminB] = $this->makeMember($this->b, Role::TenantAdmin, 'adminB');
    }

    private function register(string $agency, string $username, string $first): void
    {
        $this->postJson('/api/v1/auth/register', [
            'agency_code' => $agency, 'username' => $username, 'email' => "$username@example.test",
            'password' => 'a-long-enough-pass', 'password_confirmation' => 'a-long-enough-pass',
            'first_name' => $first, 'last_name' => 'Person', 'mobile' => '+63 900 000 0000',
        ])->assertStatus(202);
    }

    private function asAdmin(string $username): array
    {
        $this->app['auth']->forgetGuards();

        return $this->bearer($this->tokenFor($username));
    }

    public function test_admins_only_see_personal_data_of_their_own_organizations_registrations(): void
    {
        $this->register('AAA', 'alice', 'Alice');
        $this->register('BBB', 'bob', 'Bob');

        $res = $this->getJson('/api/v1/tenant/users?filter[status]=pending', $this->asAdmin('adminA'))->assertOk();
        $this->assertSame(['Alice'], collect($res->json('data'))->pluck('profile.first_name')->all());
        foreach (['Bob', 'bob@example.test'] as $needle) {
            $this->assertStringNotContainsString($needle, $res->getContent());
        }

        $res = $this->getJson('/api/v1/tenant/users?filter[status]=pending', $this->asAdmin('adminB'))->assertOk();
        $this->assertSame(['Bob'], collect($res->json('data'))->pluck('profile.first_name')->all());
    }

    public function test_an_admin_cannot_reach_another_organizations_registration_by_id(): void
    {
        $this->register('BBB', 'bob', 'Bob');
        $bobMembership = Membership::withoutTenantScope()->where('tenant_id', $this->b->id)->where('status', 'pending')->firstOrFail();

        $this->patchJson("/api/v1/tenant/users/{$bobMembership->id}", ['status' => 'active'], $this->asAdmin('adminA'))->assertStatus(404);
        $this->assertSame('pending', $bobMembership->refresh()->status->value);
    }

    public function test_unfiltered_queries_return_only_the_active_tenants_profiles_and_requests(): void
    {
        $this->register('AAA', 'alice', 'Alice');
        $this->register('BBB', 'bob', 'Bob');
        foreach ([[$this->a, 'alice'], [$this->b, 'bob']] as [$tenant, $name]) {
            $m = Membership::withoutTenantScope()->where('tenant_id', $tenant->id)->where('status', 'pending')->firstOrFail();
            (new DeletionRequest)->forceFill(['tenant_id' => $tenant->id, 'membership_id' => $m->id, 'status' => 'pending', 'requested_at' => now()])->save();
        }

        $ctx = app(TenantContext::class);
        $names = $ctx->runAs($this->a->id, $this->adminA->id, $this->adminA->user_id, Role::TenantAdmin, fn () => CrewProfile::all()->pluck('first_name')->all());
        $requests = $ctx->runAs($this->a->id, $this->adminA->id, $this->adminA->user_id, Role::TenantAdmin, fn () => DeletionRequest::count());

        $this->assertSame(['Alice'], $names);
        $this->assertSame(1, $requests);
    }

    public function test_new_tables_fail_closed_without_a_tenant_context(): void
    {
        foreach ([CrewProfile::class, DeletionRequest::class] as $model) {
            try {
                $model::count();
                $this->fail("$model answered without a tenant context");
            } catch (MissingTenantContext) {
                $this->addToAssertionCount(1);
            }
        }
    }

    public function test_the_database_refuses_a_profile_or_request_pointing_at_another_tenants_membership(): void
    {
        foreach ([CrewProfile::class => ['first_name' => 'X', 'last_name' => 'Y'], DeletionRequest::class => ['status' => 'pending', 'requested_at' => now()]] as $model => $attrs) {
            try {
                (new $model)->forceFill(['tenant_id' => $this->a->id, 'membership_id' => $this->adminB->id] + $attrs)->save();
                $this->fail("$model accepted another tenant's membership");
            } catch (QueryException) {
                $this->addToAssertionCount(1);
            }
        }
    }

    public function test_one_profile_and_one_request_per_membership(): void
    {
        $profile = ['tenant_id' => $this->a->id, 'membership_id' => $this->adminA->id, 'first_name' => 'A', 'last_name' => 'B'];
        (new CrewProfile)->forceFill($profile)->save();
        try {
            (new CrewProfile)->forceFill($profile)->save();
            $this->fail('second profile accepted');
        } catch (QueryException) {
            $this->addToAssertionCount(1);
        }

        $request = ['tenant_id' => $this->a->id, 'membership_id' => $this->adminA->id, 'status' => 'pending', 'requested_at' => now()];
        (new DeletionRequest)->forceFill($request)->save();
        $this->expectException(QueryException::class);
        (new DeletionRequest)->forceFill($request)->save();
    }

    public function test_registering_with_one_agency_code_can_never_land_in_another_organization(): void
    {
        $this->register('AAA', 'alice', 'Alice');

        $this->assertSame(1, Membership::withoutTenantScope()->where('tenant_id', $this->a->id)->where('status', 'pending')->count());
        $this->assertSame(0, Membership::withoutTenantScope()->where('tenant_id', $this->b->id)->where('status', 'pending')->count());
        $this->assertSame(0, CrewProfile::withoutTenantScope()->where('tenant_id', $this->b->id)->count());
    }
}

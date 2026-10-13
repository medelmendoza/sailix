<?php

namespace Tests\Feature;

use App\Enums\MembershipStatus;
use App\Enums\Role;
use App\Mail\DeletionRequested;
use App\Models\AuditLog;
use App\Models\DeletionRequest;
use App\Models\Membership;
use App\Models\User;
use App\Support\Tenancy\TenantContext;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class DeletionRequestTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
    }

    private function as(string $username): array
    {
        $this->app['auth']->forgetGuards();

        return $this->bearer($this->tokenFor($username));
    }

    public function test_a_member_can_request_deletion_once_and_nothing_is_deleted(): void
    {
        $tenant = $this->makeTenant('SFAI');
        $this->makeMember($tenant, Role::TenantAdmin, 'admin1');
        [$crew, $m] = $this->makeMember($tenant, Role::Crew, 'crew1');

        $first = $this->postJson('/api/v1/me/deletion-request', [], $this->as('crew1'))->assertStatus(202)->assertJsonPath('data.status', 'pending');
        $second = $this->postJson('/api/v1/me/deletion-request', [], $this->as('crew1'))->assertStatus(202);

        $this->assertSame($first->json('data.id'), $second->json('data.id'), 'idempotent');
        $this->assertSame(1, DeletionRequest::withoutTenantScope()->count());

        // access and data are untouched until an administrator acts (Q-3 pending)
        $this->assertSame(MembershipStatus::Active, $m->refresh()->status);
        $this->assertTrue(User::whereKey($crew->id)->exists());
        $this->postJson('/api/v1/auth/token', ['username' => 'crew1', 'password' => self::PASSWORD, 'device_name' => 'd'])->assertOk();
    }

    public function test_only_active_admins_of_the_same_organization_are_notified_and_only_once(): void
    {
        $a = $this->makeTenant('AAA');
        $b = $this->makeTenant('BBB');
        $this->makeMember($a, Role::TenantAdmin, 'adminA');
        $this->makeMember($a, Role::TenantAdmin, 'adminA2');
        $this->makeMember($a, Role::TenantAdmin, 'adminSuspended', MembershipStatus::Suspended);
        $this->makeMember($b, Role::TenantAdmin, 'adminB');
        $this->makeMember($a, Role::Crew, 'crewA');

        $this->postJson('/api/v1/me/deletion-request', [], $this->as('crewA'))->assertStatus(202);
        $this->postJson('/api/v1/me/deletion-request', [], $this->as('crewA'))->assertStatus(202);

        Mail::assertQueued(DeletionRequested::class, 2);
        Mail::assertQueued(DeletionRequested::class, fn ($m) => $m->hasTo('adminA@example.test') && $m->organization === 'AAA Agency');
        Mail::assertQueued(DeletionRequested::class, fn ($m) => $m->hasTo('adminA2@example.test'));
        Mail::assertNotQueued(DeletionRequested::class, fn ($m) => $m->hasTo('adminB@example.test') || $m->hasTo('adminSuspended@example.test'));
    }

    public function test_admins_list_pending_requests_with_the_members_profile_but_crew_cannot(): void
    {
        $tenant = $this->makeTenant('SFAI');
        $this->makeMember($tenant, Role::TenantAdmin, 'admin1');
        $this->makeMember($tenant, Role::Crew, 'crew1');
        $this->postJson('/api/v1/me/deletion-request', [], $this->as('crew1'))->assertStatus(202);

        $list = $this->getJson('/api/v1/tenant/deletion-requests', $this->as('admin1'))->assertOk()->assertJsonCount(1, 'data');
        $this->assertSame('crew1', $list->json('data.0.membership.user.username'));
        $this->assertSame('pending', $list->json('data.0.status'));

        $this->getJson('/api/v1/tenant/deletion-requests', $this->as('crew1'))->assertStatus(403);
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/tenant/deletion-requests')->assertStatus(401);
    }

    public function test_an_organization_never_sees_another_organizations_requests(): void
    {
        $a = $this->makeTenant('AAA');
        $b = $this->makeTenant('BBB');
        $this->makeMember($a, Role::TenantAdmin, 'adminA');
        $this->makeMember($b, Role::TenantAdmin, 'adminB');
        $this->makeMember($b, Role::Crew, 'crewB');
        $this->postJson('/api/v1/me/deletion-request', [], $this->as('crewB'))->assertStatus(202);

        $this->getJson('/api/v1/tenant/deletion-requests', $this->as('adminA'))->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/tenant/deletion-requests', $this->as('adminB'))->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_it_requires_a_usable_membership_and_is_throttled(): void
    {
        $tenant = $this->makeTenant('SFAI');
        [, $m] = $this->makeMember($tenant, Role::Crew, 'crew1');

        $this->postJson('/api/v1/me/deletion-request')->assertStatus(401);

        $h = $this->as('crew1');
        for ($i = 0; $i < 3; $i++) {
            $this->app['auth']->forgetGuards();
            $this->postJson('/api/v1/me/deletion-request', [], $h)->assertStatus(202);
        }
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/me/deletion-request', [], $h)->assertStatus(429);

        $m->forceFill(['status' => MembershipStatus::Suspended])->save();
        $this->app['cache']->store()->flush();
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/me/deletion-request', [], $h)->assertStatus(403)->assertJsonPath('code', 'membership_suspended');
    }

    public function test_the_request_is_audited_per_organization(): void
    {
        $tenant = $this->makeTenant('SFAI');
        $this->makeMember($tenant, Role::TenantAdmin, 'admin1');
        $this->makeMember($tenant, Role::Crew, 'crew1');
        $this->postJson('/api/v1/me/deletion-request', [], $this->as('crew1'))->assertStatus(202);

        app(TenantContext::class)->markPlatform();
        $entry = AuditLog::where('action', 'deletion.requested')->firstOrFail();
        $this->assertSame($tenant->id, $entry->tenant_id);
        $this->assertSame(1, Membership::withoutTenantScope()->where('status', 'active')->where('role', 'crew')->count());
    }
}

<?php

namespace Tests\Feature;

use App\Enums\MembershipStatus;
use App\Enums\Role;
use App\Models\AuditLog;
use App\Models\Membership;
use App\Models\Todo;
use App\Support\Tenancy\TenantContext;
use Tests\TestCase;

class TodoTest extends TestCase
{
    /** @var array<string, string> membership ids by username */
    private array $m = [];

    private function setUpOrganizations(): void
    {
        $a = $this->makeTenant('AAA');
        $b = $this->makeTenant('BBB');
        foreach ([[$a, Role::TenantAdmin, 'adminA'], [$a, Role::Crew, 'crewA'], [$a, Role::Crew, 'crewA2'], [$b, Role::TenantAdmin, 'adminB'], [$b, Role::Crew, 'crewB']] as [$t, $role, $name]) {
            [, $membership] = $this->makeMember($t, $role, $name);
            $this->m[$name] = $membership->id;
        }
    }

    private function assign(string $by, array $to, array $extra = [])
    {
        return $this->postJson('/api/v1/tenant/todos', $extra + ['description' => 'Renew your passport', 'membership_ids' => array_map(fn ($n) => $this->m[$n], $to)], $this->as($by));
    }

    public function test_an_administrator_assigns_a_task_to_several_members_and_each_sees_only_their_own(): void
    {
        $this->setUpOrganizations();
        $this->assign('adminA', ['crewA', 'crewA2'], ['due_date' => '2030-01-15'])->assertCreated()->assertJsonCount(2, 'data');

        foreach (['crewA', 'crewA2'] as $who) {
            $list = $this->getJson('/api/v1/todos', $this->as($who))->assertOk();
            $this->assertSame(['Renew your passport'], array_column($list->json('data'), 'description'));
            $this->assertSame('2030-01-15', $list->json('data.0.due_date'));
            $this->assertSame(1, $list->json('open_count'));
        }
        $this->assertSame([], $this->getJson('/api/v1/todos', $this->as('adminA'))->json('data')); // the admin was not assigned
    }

    public function test_the_organization_author_and_state_come_from_the_session_never_the_body(): void
    {
        $this->setUpOrganizations();
        $r = $this->assign('adminA', ['crewA'], ['tenant_id' => 'x', 'created_by_membership_id' => 'x', 'is_done' => true, 'done_at' => now()->toIso8601String()])->assertCreated();

        $row = Todo::withoutTenantScope()->findOrFail($r->json('data.0.id'));
        $this->assertNotSame('x', $row->tenant_id);
        $this->assertSame($this->m['adminA'], $row->created_by_membership_id);
        $this->assertFalse($row->is_done);
        $this->assertNull($row->done_at);
    }

    public function test_assignees_must_be_active_members_of_the_same_organization_and_otherwise_nothing_is_created(): void
    {
        $this->setUpOrganizations();

        $this->assign('adminA', ['crewA', 'crewB'])->assertStatus(422)->assertJsonPath('code', 'invalid_assignee'); // one from another organization
        $this->postJson('/api/v1/tenant/todos', ['description' => 'x', 'membership_ids' => ['00000000-0000-0000-0000-000000000000']], $this->as('adminA'))->assertStatus(422);
        Membership::withoutTenantScope()->whereKey($this->m['crewA2'])->update(['status' => MembershipStatus::Suspended]);
        $this->assign('adminA', ['crewA2'])->assertStatus(422)->assertJsonPath('code', 'invalid_assignee');

        $this->assertSame(0, Todo::withoutTenantScope()->count());
    }

    public function test_a_member_ticks_and_unticks_only_their_own_task_and_nothing_else_changes(): void
    {
        $this->setUpOrganizations();
        $id = $this->assign('adminA', ['crewA'])->json('data.0.id');

        $done = $this->patchJson("/api/v1/todos/$id", ['is_done' => true, 'description' => 'hacked', 'due_date' => '2001-01-01'], $this->as('crewA'))
            ->assertOk()->assertJsonPath('data.is_done', true);
        $this->assertNotNull($done->json('data.done_at'));
        $row = Todo::withoutTenantScope()->findOrFail($id);
        $this->assertSame('Renew your passport', $row->description);
        $this->assertNull($row->due_date);

        $first = $row->done_at;
        $this->patchJson("/api/v1/todos/$id", ['is_done' => true], $this->as('crewA'))->assertOk(); // idempotent
        $this->assertTrue(Todo::withoutTenantScope()->findOrFail($id)->done_at->equalTo($first));

        $this->patchJson("/api/v1/todos/$id", ['is_done' => false], $this->as('crewA'))->assertOk()->assertJsonPath('data.done_at', null);
    }

    public function test_nobody_can_touch_someone_elses_task_in_the_same_or_another_organization(): void
    {
        $this->setUpOrganizations();
        $id = $this->assign('adminA', ['crewA'])->json('data.0.id');

        $this->patchJson("/api/v1/todos/$id", ['is_done' => true], $this->as('crewA2'))->assertNotFound(); // colleague
        $this->patchJson("/api/v1/todos/$id", ['is_done' => true], $this->as('crewB'))->assertNotFound(); // other organization
        $this->patchJson("/api/v1/tenant/todos/$id", ['description' => 'x'], $this->as('adminB'))->assertNotFound();
        $this->deleteJson("/api/v1/tenant/todos/$id", [], $this->as('adminB'))->assertNotFound();
        $this->assertFalse(Todo::withoutTenantScope()->findOrFail($id)->is_done);
        $this->assertSame([], $this->getJson('/api/v1/todos', $this->as('crewA2'))->json('data'));
    }

    public function test_crew_cannot_manage_and_unauthenticated_requests_are_refused(): void
    {
        $this->setUpOrganizations();
        $id = $this->assign('adminA', ['crewA'])->json('data.0.id');

        $this->postJson('/api/v1/tenant/todos', ['description' => 'x', 'membership_ids' => [$this->m['crewA']]], $this->as('crewA'))->assertForbidden();
        $this->getJson('/api/v1/tenant/todos', $this->as('crewA'))->assertForbidden();
        $this->patchJson("/api/v1/tenant/todos/$id", ['description' => 'x'], $this->as('crewA'))->assertForbidden();
        $this->deleteJson("/api/v1/tenant/todos/$id", [], $this->as('crewA'))->assertForbidden();
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/todos')->assertUnauthorized();
        $this->patchJson("/api/v1/todos/$id", ['is_done' => true])->assertUnauthorized();
    }

    public function test_the_list_orders_open_before_done_soonest_due_first_and_counts_overdue(): void
    {
        $this->setUpOrganizations();
        $later = $this->assign('adminA', ['crewA'], ['description' => 'Later', 'due_date' => now()->addDays(10)->toDateString()])->json('data.0.id');
        $this->assign('adminA', ['crewA'], ['description' => 'Overdue', 'due_date' => now()->subDays(3)->toDateString()])->assertCreated();
        $this->assign('adminA', ['crewA'], ['description' => 'No date'])->assertCreated();
        $done = $this->assign('adminA', ['crewA'], ['description' => 'Finished', 'due_date' => now()->subDays(9)->toDateString()])->json('data.0.id');
        $this->patchJson("/api/v1/todos/$done", ['is_done' => true], $this->as('crewA'))->assertOk();

        $list = $this->getJson('/api/v1/todos', $this->as('crewA'))->assertOk();
        $this->assertSame(['Overdue', 'Later', 'No date', 'Finished'], array_column($list->json('data'), 'description'));
        $this->assertSame(3, $list->json('open_count'));
        $this->assertSame(1, $list->json('overdue_count')); // a finished task is never overdue

        $open = $this->getJson('/api/v1/todos?status=open', $this->as('crewA'));
        $this->assertSame(3, count($open->json('data')));
        $this->assertSame(['Finished'], array_column($this->getJson('/api/v1/todos?status=done', $this->as('crewA'))->json('data'), 'description'));
        $this->assertNotNull($later);
    }

    public function test_the_administrator_lists_every_task_of_the_organization_with_the_assignee_and_can_filter(): void
    {
        $this->setUpOrganizations();
        $this->assign('adminA', ['crewA'], ['description' => 'For A'])->assertCreated();
        $this->assign('adminA', ['crewA2'], ['description' => 'For A2'])->assertCreated();
        $this->assign('adminB', ['crewB'], ['description' => 'Other company'])->assertCreated();

        $all = $this->getJson('/api/v1/tenant/todos', $this->as('adminA'))->assertOk();
        $this->assertEqualsCanonicalizing(['For A', 'For A2'], array_column($all->json('data'), 'description'));
        $this->assertSame('crewA', $all->json('data.0.assignee.user.username') === 'crewA' ? 'crewA' : $all->json('data.1.assignee.user.username'));

        $one = $this->getJson('/api/v1/tenant/todos?membership_id='.$this->m['crewA2'], $this->as('adminA'));
        $this->assertSame(['For A2'], array_column($one->json('data'), 'description'));
    }

    public function test_editing_and_deleting(): void
    {
        $this->setUpOrganizations();
        $id = $this->assign('adminA', ['crewA'])->json('data.0.id');

        $this->patchJson("/api/v1/tenant/todos/$id", ['description' => '  New text  ', 'due_date' => '2031-02-03'], $this->as('adminA'))
            ->assertOk()->assertJsonPath('data.description', 'New text')->assertJsonPath('data.due_date', '2031-02-03');
        $this->patchJson("/api/v1/tenant/todos/$id", ['membership_ids' => [$this->m['crewA2']]], $this->as('adminA'))->assertStatus(422); // cannot be reassigned
        $this->patchJson("/api/v1/tenant/todos/$id", ['due_date' => null], $this->as('adminA'))->assertOk()->assertJsonPath('data.due_date', null);

        $this->deleteJson("/api/v1/tenant/todos/$id", [], $this->as('adminA'))->assertNoContent();
        $this->assertSame(0, Todo::withoutTenantScope()->count());
        $this->assertSame([], $this->getJson('/api/v1/todos', $this->as('crewA'))->json('data'));
    }

    public function test_validation(): void
    {
        $this->setUpOrganizations();
        $crew = [$this->m['crewA']];
        $post = fn (array $body) => $this->postJson('/api/v1/tenant/todos', $body, $this->as('adminA'));

        $post(['description' => '', 'membership_ids' => $crew])->assertStatus(422);
        $post(['description' => str_repeat('a', 501), 'membership_ids' => $crew])->assertStatus(422);
        $post(['description' => 'x', 'membership_ids' => []])->assertStatus(422);
        $post(['description' => 'x'])->assertStatus(422);
        $post(['description' => 'x', 'membership_ids' => [$crew[0], $crew[0]]])->assertStatus(422); // duplicates
        $post(['description' => 'x', 'membership_ids' => $crew, 'due_date' => '15/01/2030'])->assertStatus(422);
        $post(['description' => 'x', 'membership_ids' => $crew, 'due_date' => '2030-02-30'])->assertStatus(422);
        $this->patchJson('/api/v1/todos/'.str_repeat('a', 36), ['is_done' => true], $this->as('crewA'))->assertStatus(404); // a well-formed id that is not theirs
        $this->patchJson('/api/v1/todos/'.str_repeat('a', 36), ['is_done' => 'maybe'], $this->as('crewA'))->assertStatus(422);
        $this->assertSame(0, Todo::withoutTenantScope()->count());
    }

    public function test_malformed_ids_are_not_found(): void
    {
        $this->setUpOrganizations();
        foreach (['not-an-id', '..%2f..', str_repeat('a', 200)] as $bad) {
            $this->patchJson("/api/v1/todos/$bad", ['is_done' => true], $this->as('crewA'))->assertNotFound();
            $this->patchJson("/api/v1/tenant/todos/$bad", ['description' => 'x'], $this->as('adminA'))->assertNotFound();
        }
    }

    public function test_the_audit_trail_records_that_it_happened_but_not_the_text(): void
    {
        $this->setUpOrganizations();
        $id = $this->assign('adminA', ['crewA', 'crewA2'], ['description' => 'Confidential errand'])->json('data.0.id');
        $this->patchJson("/api/v1/tenant/todos/$id", ['description' => 'Another secret'], $this->as('adminA'))->assertOk();
        $this->deleteJson("/api/v1/tenant/todos/$id", [], $this->as('adminA'))->assertNoContent();

        $logs = AuditLog::query()->tap(fn () => app(TenantContext::class)->markPlatform())->where('action', 'like', 'todo.%')->get();
        $this->assertEqualsCanonicalizing(['todo.created', 'todo.updated', 'todo.deleted'], $logs->pluck('action')->all());
        $this->assertStringNotContainsString('Confidential', json_encode($logs->toArray()));
        $this->assertStringNotContainsString('secret', json_encode($logs->toArray()));
    }
}

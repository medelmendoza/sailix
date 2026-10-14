<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Feedback;
use Tests\TestCase;

class FeedbackTest extends TestCase
{
    public function test_a_member_sends_feedback_and_it_is_stored_for_their_own_organization_and_membership(): void
    {
        $a = $this->makeTenant('AAA');
        $b = $this->makeTenant('BBB');
        [, $m] = $this->makeMember($a, Role::Crew, 'crewA');
        $this->makeMember($b, Role::Crew, 'crewB');

        // a client-supplied organization or member is ignored
        $r = $this->postJson('/api/v1/me/feedback', [
            'category' => 'idea', 'message' => '  Please add dark mode  ', 'tenant_id' => $b->id, 'membership_id' => 'x',
        ], $this->as('crewA'))->assertCreated()->assertJsonPath('data.category', 'idea')->assertJsonPath('data.message', 'Please add dark mode');

        $row = Feedback::withoutTenantScope()->findOrFail($r->json('data.id'));
        $this->assertSame($a->id, $row->tenant_id);
        $this->assertSame($m->id, $row->membership_id);
    }

    public function test_it_validates_category_and_message(): void
    {
        $this->makeMember($this->makeTenant('AAA'), Role::Crew, 'crewA');
        $h = $this->as('crewA');

        $this->postJson('/api/v1/me/feedback', ['category' => 'spam', 'message' => 'hello there'], $h)->assertStatus(422);
        $this->postJson('/api/v1/me/feedback', ['category' => 'bug', 'message' => 'x'], $h)->assertStatus(422);
        $this->postJson('/api/v1/me/feedback', ['category' => 'bug', 'message' => str_repeat('a', 2001)], $h)->assertStatus(422);
        $this->postJson('/api/v1/me/feedback', ['category' => 'bug'], $h)->assertStatus(422);
        $this->assertSame(0, Feedback::withoutTenantScope()->count());
    }

    public function test_it_requires_authentication(): void
    {
        $this->postJson('/api/v1/me/feedback', ['category' => 'bug', 'message' => 'hello there'])->assertStatus(401);
    }

    public function test_it_is_limited_to_ten_a_day(): void
    {
        $this->makeMember($this->makeTenant('AAA'), Role::Crew, 'crewA');
        $h = $this->as('crewA');
        for ($i = 0; $i < 10; $i++) {
            $this->postJson('/api/v1/me/feedback', ['category' => 'bug', 'message' => "problem $i"], $h)->assertCreated();
        }
        $this->postJson('/api/v1/me/feedback', ['category' => 'bug', 'message' => 'one more'], $h)->assertStatus(429);
    }

    public function test_only_administrators_read_feedback_and_only_their_own_organizations(): void
    {
        $a = $this->makeTenant('AAA');
        $b = $this->makeTenant('BBB');
        $this->makeMember($a, Role::TenantAdmin, 'adminA');
        $this->makeMember($a, Role::Crew, 'crewA');
        $this->makeMember($b, Role::Crew, 'crewB');
        $this->postJson('/api/v1/me/feedback', ['category' => 'bug', 'message' => 'from A'], $this->as('crewA'))->assertCreated();
        $this->postJson('/api/v1/me/feedback', ['category' => 'bug', 'message' => 'from B'], $this->as('crewB'))->assertCreated();

        $this->getJson('/api/v1/tenant/feedback', $this->as('crewA'))->assertForbidden();
        $list = $this->getJson('/api/v1/tenant/feedback', $this->as('adminA'))->assertOk();
        $this->assertSame(['from A'], array_column($list->json('data'), 'message'));
    }
}

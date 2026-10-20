<?php

namespace Tests\Feature;

use App\Enums\MembershipStatus;
use App\Enums\Role;
use App\Models\Announcement;
use App\Models\AnnouncementRead;
use App\Models\AuditLog;
use App\Models\CrewProfile;
use App\Models\Membership;
use App\Support\Tenancy\TenantContext;
use Database\Seeders\CrewPortalDemoSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AnnouncementTest extends TestCase
{
    private function setUpTwoOrganizations(): void
    {
        $a = $this->makeTenant('AAA');
        $b = $this->makeTenant('BBB');
        $this->makeMember($a, Role::TenantAdmin, 'adminA');
        $this->makeMember($a, Role::Crew, 'crewA');
        $this->makeMember($a, Role::Crew, 'crewA2');
        $this->makeMember($b, Role::TenantAdmin, 'adminB');
        $this->makeMember($b, Role::Crew, 'crewB');
    }

    private function create(string $as, array $body = [])
    {
        return $this->postJson('/api/v1/tenant/announcements', $body + ['title' => 'Drill on Friday', 'body' => 'Muster at 10:00.'], $this->as($as));
    }

    public function test_an_administrator_writes_an_announcement_and_every_member_of_that_organization_sees_it(): void
    {
        $this->setUpTwoOrganizations();

        $this->create('adminA')->assertCreated()->assertJsonPath('data.title', 'Drill on Friday')->assertJsonPath('data.is_active', true);

        foreach (['crewA', 'crewA2', 'adminA'] as $who) {
            $list = $this->getJson('/api/v1/announcements', $this->as($who))->assertOk();
            $this->assertSame(['Drill on Friday'], array_column($list->json('data'), 'title'));
            $this->assertSame(1, $list->json('unread_count'));
            $this->assertFalse($list->json('data.0.is_read'));
        }
    }

    public function test_the_organization_and_author_come_from_the_session_never_the_body(): void
    {
        $this->setUpTwoOrganizations();
        $b = $this->makeTenant('CCC');

        $r = $this->create('adminA', ['tenant_id' => $b->id, 'created_by_membership_id' => 'x', 'is_read' => true])->assertCreated();

        $row = Announcement::withoutTenantScope()->findOrFail($r->json('data.id'));
        $this->assertNotSame($b->id, $row->tenant_id);
        $this->assertNotNull($row->created_by_membership_id);
        $this->assertNotSame('x', $row->created_by_membership_id);
    }

    public function test_announcements_never_cross_organizations(): void
    {
        $this->setUpTwoOrganizations();
        $mine = $this->create('adminA')->json('data.id');
        $this->create('adminB', ['title' => 'Other company'])->assertCreated();

        $titles = array_column($this->getJson('/api/v1/announcements', $this->as('crewA'))->json('data'), 'title');
        $this->assertSame(['Drill on Friday'], $titles);

        // another organization's member cannot open, read-mark or manage it, and cannot tell it exists
        $h = $this->as('crewB');
        $this->getJson("/api/v1/announcements/$mine", $h)->assertNotFound();
        $this->putJson("/api/v1/announcements/$mine/read", [], $this->as('crewB'))->assertNotFound();
        $this->patchJson("/api/v1/tenant/announcements/$mine", ['title' => 'hijack'], $this->as('adminB'))->assertNotFound();
        $this->deleteJson("/api/v1/tenant/announcements/$mine", [], $this->as('adminB'))->assertNotFound();
        $this->assertSame('Drill on Friday', Announcement::withoutTenantScope()->findOrFail($mine)->title);
    }

    public function test_crew_can_read_but_not_manage(): void
    {
        $this->setUpTwoOrganizations();
        $id = $this->create('adminA')->json('data.id');

        $this->postJson('/api/v1/tenant/announcements', ['title' => 'x', 'body' => 'y'], $this->as('crewA'))->assertForbidden();
        $this->getJson('/api/v1/tenant/announcements', $this->as('crewA'))->assertForbidden();
        $this->patchJson("/api/v1/tenant/announcements/$id", ['title' => 'x'], $this->as('crewA'))->assertForbidden();
        $this->deleteJson("/api/v1/tenant/announcements/$id", [], $this->as('crewA'))->assertForbidden();
        $this->assertSame(1, Announcement::withoutTenantScope()->count());
    }

    public function test_unauthenticated_requests_are_refused(): void
    {
        $this->getJson('/api/v1/announcements')->assertUnauthorized();
        $this->postJson('/api/v1/tenant/announcements', ['title' => 'x', 'body' => 'y'])->assertUnauthorized();
    }

    public function test_reading_is_per_member_idempotent_and_updates_the_unread_count(): void
    {
        $this->setUpTwoOrganizations();
        $id = $this->create('adminA')->json('data.id');
        $this->create('adminA', ['title' => 'Second'])->assertCreated();

        $this->putJson("/api/v1/announcements/$id/read", [], $this->as('crewA'))->assertOk()->assertJsonPath('data.is_read', true);
        $this->putJson("/api/v1/announcements/$id/read", [], $this->as('crewA'))->assertOk();

        $mine = $this->getJson('/api/v1/announcements', $this->as('crewA'));
        $this->assertSame(1, $mine->json('unread_count'));
        $byTitle = collect($mine->json('data'))->pluck('is_read', 'title');
        $this->assertTrue($byTitle['Drill on Friday']);
        $this->assertFalse($byTitle['Second']);

        // someone else's read state is unaffected
        $this->assertSame(2, $this->getJson('/api/v1/announcements', $this->as('crewA2'))->json('unread_count'));
        $this->assertSame(1, AnnouncementRead::withoutTenantScope()->count());
    }

    public function test_switched_off_and_expired_announcements_are_hidden_from_members_but_listed_for_admins(): void
    {
        $this->setUpTwoOrganizations();
        $off = $this->create('adminA', ['title' => 'Off'])->json('data.id');
        $this->patchJson("/api/v1/tenant/announcements/$off", ['is_active' => false], $this->as('adminA'))->assertOk();
        $expired = $this->create('adminA', ['title' => 'Old'])->json('data.id');
        Announcement::withoutTenantScope()->whereKey($expired)->update(['expires_at' => now()->subDay()]);
        $this->create('adminA', ['title' => 'Live', 'expires_at' => now()->addWeek()->toIso8601String()])->assertCreated();

        $member = $this->getJson('/api/v1/announcements', $this->as('crewA'));
        $this->assertSame(['Live'], array_column($member->json('data'), 'title'));
        $this->assertSame(1, $member->json('unread_count'));
        $this->getJson("/api/v1/announcements/$off", $this->as('crewA'))->assertNotFound();
        $this->getJson("/api/v1/announcements/$expired", $this->as('crewA'))->assertNotFound();

        $admin = $this->getJson('/api/v1/tenant/announcements', $this->as('adminA'))->assertOk();
        $this->assertEqualsCanonicalizing(['Off', 'Old', 'Live'], array_column($admin->json('data'), 'title'));
    }

    public function test_editing_and_deleting(): void
    {
        $this->setUpTwoOrganizations();
        $id = $this->create('adminA')->json('data.id');
        $this->putJson("/api/v1/announcements/$id/read", [], $this->as('crewA'))->assertOk();

        $this->patchJson("/api/v1/tenant/announcements/$id", ['title' => '  New title  '], $this->as('adminA'))
            ->assertOk()->assertJsonPath('data.title', 'New title')->assertJsonPath('data.body', 'Muster at 10:00.');

        $this->deleteJson("/api/v1/tenant/announcements/$id", [], $this->as('adminA'))->assertNoContent();
        $this->assertSame(0, Announcement::withoutTenantScope()->count());
        $this->assertSame(0, AnnouncementRead::withoutTenantScope()->count()); // read records go with it
        $this->getJson("/api/v1/announcements/$id", $this->as('crewA'))->assertNotFound();
    }

    public function test_validation(): void
    {
        $this->setUpTwoOrganizations();
        $h = $this->as('adminA');

        $this->postJson('/api/v1/tenant/announcements', ['title' => '', 'body' => 'x'], $h)->assertStatus(422);
        $this->postJson('/api/v1/tenant/announcements', ['title' => 'x', 'body' => ''], $this->as('adminA'))->assertStatus(422);
        $this->postJson('/api/v1/tenant/announcements', ['title' => str_repeat('a', 151), 'body' => 'x'], $this->as('adminA'))->assertStatus(422);
        $this->postJson('/api/v1/tenant/announcements', ['title' => 'x', 'body' => str_repeat('a', 5001)], $this->as('adminA'))->assertStatus(422);
        $this->postJson('/api/v1/tenant/announcements', ['title' => 'x', 'body' => 'y', 'expires_at' => now()->subDay()->toIso8601String()], $this->as('adminA'))->assertStatus(422);
        $this->assertSame(0, Announcement::withoutTenantScope()->count());
    }

    public function test_malformed_ids_are_not_found_not_errors(): void
    {
        $this->setUpTwoOrganizations();
        foreach (['not-an-id', '..%2f..', str_repeat('a', 200)] as $bad) {
            $this->getJson("/api/v1/announcements/$bad", $this->as('crewA'))->assertNotFound();
        }
    }

    public function test_a_suspended_member_cannot_read_announcements(): void
    {
        $this->setUpTwoOrganizations();
        $this->create('adminA')->assertCreated();
        $h = $this->as('crewA');
        Membership::withoutTenantScope()->whereHas('user', fn ($q) => $q->where('username', 'crewA'))->update(['status' => MembershipStatus::Suspended]);

        $this->assertContains($this->getJson('/api/v1/announcements', $h)->status(), [401, 403]);
    }

    public function test_the_audit_trail_records_that_it_happened_but_not_the_text(): void
    {
        $this->setUpTwoOrganizations();
        $id = $this->create('adminA', ['title' => 'Confidential title', 'body' => 'Secret body text'])->json('data.id');
        $this->patchJson("/api/v1/tenant/announcements/$id", ['body' => 'Another secret'], $this->as('adminA'))->assertOk();
        $this->deleteJson("/api/v1/tenant/announcements/$id", [], $this->as('adminA'))->assertNoContent();

        $logs = AuditLog::query()->tap(fn () => app(TenantContext::class)->markPlatform())->where('action', 'like', 'announcement.%')->get();
        $this->assertEqualsCanonicalizing(['announcement.created', 'announcement.updated', 'announcement.deleted'], $logs->pluck('action')->all());
        $this->assertStringNotContainsString('Secret', json_encode($logs->toArray()));
        $this->assertStringNotContainsString('Confidential', json_encode($logs->toArray()));
    }

    private function fleet(string $username, ?string $fleet): void
    {
        $membership = Membership::withoutTenantScope()->whereHas('user', fn ($u) => $u->where('username', $username))->firstOrFail();
        (new CrewProfile)->forceFill([
            'tenant_id' => $membership->tenant_id, 'membership_id' => $membership->id, 'first_name' => ucfirst($username), 'last_name' => 'Crew', 'fleet' => $fleet,
        ])->save();
    }

    private function titlesFor(string $who): array
    {
        return array_column($this->getJson('/api/v1/announcements', $this->as($who))->assertOk()->json('data'), 'title');
    }

    public function test_an_announcement_for_chosen_fleets_reaches_only_those_fleets_and_everyone_else_still_gets_the_rest(): void
    {
        $this->setUpTwoOrganizations();
        $this->fleet('crewA', 'Fleet B');
        $this->fleet('crewA2', 'Fleet C');

        $this->create('adminA', ['title' => 'For everyone'])->assertCreated()->assertJsonPath('data.fleets', []);
        $this->create('adminA', ['title' => 'Fleet B only', 'fleets' => ['fleet b']])->assertCreated()->assertJsonPath('data.fleets', ['fleet b']);

        $this->assertEqualsCanonicalizing(['For everyone', 'Fleet B only'], $this->titlesFor('crewA')); // the fleet name is not case-sensitive
        $this->assertSame(['For everyone'], $this->titlesFor('crewA2'));
        $this->assertSame(['For everyone'], $this->titlesFor('adminA')); // no fleet on record: only what is for everyone
    }

    public function test_the_unread_count_and_the_single_view_follow_the_audience_too(): void
    {
        $this->setUpTwoOrganizations();
        $this->fleet('crewA', 'Fleet B');
        $this->fleet('crewA2', 'Fleet C');
        $id = $this->create('adminA', ['fleets' => ['Fleet B']])->json('data.id');

        $this->assertSame(1, $this->getJson('/api/v1/announcements', $this->as('crewA'))->json('unread_count'));
        $this->assertSame(0, $this->getJson('/api/v1/announcements', $this->as('crewA2'))->json('unread_count'));
        $this->getJson('/api/v1/announcements/'.$id, $this->as('crewA'))->assertOk();
        $this->getJson('/api/v1/announcements/'.$id, $this->as('crewA2'))->assertNotFound(); // not addressed to them: looks like it does not exist
        $this->putJson('/api/v1/announcements/'.$id.'/read', [], $this->as('crewA2'))->assertNotFound();
    }

    public function test_the_audience_can_be_changed_and_cleared_and_is_validated(): void
    {
        $this->setUpTwoOrganizations();
        $id = $this->create('adminA', ['fleets' => ['Fleet B', 'Fleet C']])->json('data.id');

        $this->patchJson('/api/v1/tenant/announcements/'.$id, ['fleets' => ['Fleet C']], $this->as('adminA'))->assertOk()->assertJsonPath('data.fleets', ['Fleet C']);
        $this->patchJson('/api/v1/tenant/announcements/'.$id, ['title' => 'Renamed'], $this->as('adminA'))->assertOk()->assertJsonPath('data.fleets', ['Fleet C']); // untouched when not sent
        $this->patchJson('/api/v1/tenant/announcements/'.$id, ['fleets' => []], $this->as('adminA'))->assertOk()->assertJsonPath('data.fleets', []); // everyone again

        $this->create('adminA', ['fleets' => ['Fleet B', 'fleet b']])->assertStatus(422);
        $this->create('adminA', ['fleets' => [str_repeat('x', 101)]])->assertStatus(422);
        $this->create('adminA', ['fleets' => 'Fleet B'])->assertStatus(422);
    }

    public function test_the_administrators_list_shows_who_wrote_it_and_the_members_view_does_not(): void
    {
        $this->setUpTwoOrganizations();
        $this->fleet('adminA', null);
        $this->create('adminA')->assertCreated();

        $this->assertSame('AdminA Crew', $this->getJson('/api/v1/tenant/announcements', $this->as('adminA'))->json('data.0.author.name'));
        $this->assertArrayNotHasKey('author', $this->getJson('/api/v1/announcements', $this->as('crewA'))->json('data.0'));
        $this->assertArrayNotHasKey('fleets', $this->getJson('/api/v1/announcements', $this->as('crewA'))->json('data.0'));
    }

    public function test_the_fleets_in_use_are_listed_for_choosing_an_audience(): void
    {
        $this->setUpTwoOrganizations();
        $this->fleet('crewA', 'Fleet B');
        $this->fleet('crewA2', 'Fleet B');
        $this->fleet('adminA', 'Fleet A');
        $this->fleet('crewB', 'Other organization fleet');

        $this->assertSame(['Fleet A', 'Fleet B'], $this->getJson('/api/v1/tenant/crew/fleets', $this->as('adminA'))->assertOk()->json('data'));
        $this->getJson('/api/v1/tenant/crew/fleets', $this->as('crewA'))->assertForbidden();
    }

    private function pdf(string $name = 'notice.pdf'): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($name, CrewPortalDemoSeeder::pdf('Notice'));
    }

    private function attach(string $as, string $id, ?UploadedFile $file = null)
    {
        return $this->post('/api/v1/tenant/announcements/'.$id.'/attachment', ['file' => $file ?? $this->pdf()], $this->as($as) + ['Accept' => 'application/json']);
    }

    public function test_an_administrator_attaches_a_file_and_members_who_can_see_the_announcement_can_open_it(): void
    {
        Storage::fake('local');
        config(['sailix.documents.disk' => 'local']);
        $this->setUpTwoOrganizations();
        $this->fleet('crewA', 'Fleet B');
        $this->fleet('crewA2', 'Fleet C');
        $id = $this->create('adminA', ['fleets' => ['Fleet B']])->json('data.id');

        $r = $this->attach('adminA', $id)->assertOk();
        $this->assertSame('application/pdf', $r->json('data.attachment.type'));
        $path = Announcement::withoutTenantScope()->findOrFail($id)->file_path;
        Storage::disk('local')->assertExists($path);
        $this->assertStringStartsWith('announcements/', $path);
        $this->assertDoesNotMatchRegularExpression('/notice/i', $path); // random name, not the client's

        $this->assertSame('notice.pdf', $this->getJson('/api/v1/announcements/'.$id, $this->as('crewA'))->json('data.attachment.name'));
        $this->get('/api/v1/announcements/'.$id.'/file', $this->as('crewA'))->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->get('/api/v1/announcements/'.$id.'/file', $this->as('crewA2') + ['Accept' => 'application/json'])->assertNotFound(); // not addressed to them
        $this->get('/api/v1/tenant/announcements/'.$id.'/file', $this->as('adminA'))->assertOk();
    }

    public function test_replacing_and_removing_the_attachment_deletes_the_old_file(): void
    {
        Storage::fake('local');
        config(['sailix.documents.disk' => 'local']);
        $this->setUpTwoOrganizations();
        $id = $this->create('adminA')->json('data.id');

        $this->attach('adminA', $id)->assertOk();
        $first = Announcement::withoutTenantScope()->findOrFail($id)->file_path;
        $this->attach('adminA', $id, $this->pdf('second.pdf'))->assertOk();
        $second = Announcement::withoutTenantScope()->findOrFail($id)->file_path;
        Storage::disk('local')->assertMissing($first);
        Storage::disk('local')->assertExists($second);

        $this->deleteJson('/api/v1/tenant/announcements/'.$id.'/attachment', [], $this->as('adminA'))->assertNoContent();
        Storage::disk('local')->assertMissing($second);
        $this->assertNull($this->getJson('/api/v1/tenant/announcements', $this->as('adminA'))->json('data.0.attachment'));
        $this->deleteJson('/api/v1/tenant/announcements/'.$id.'/attachment', [], $this->as('adminA'))->assertNoContent(); // already gone: still fine
    }

    public function test_deleting_the_announcement_deletes_its_file_and_a_wrong_kind_of_file_is_refused(): void
    {
        Storage::fake('local');
        config(['sailix.documents.disk' => 'local']);
        $this->setUpTwoOrganizations();
        $id = $this->create('adminA')->json('data.id');

        $this->attach('adminA', $id, $this->realUpload('run.pdf', '<?php echo 1;'))->assertStatus(422); // judged by content, not the name
        $this->attach('adminA', $id)->assertOk();
        $path = Announcement::withoutTenantScope()->findOrFail($id)->file_path;

        $this->deleteJson('/api/v1/tenant/announcements/'.$id, [], $this->as('adminA'))->assertNoContent();
        Storage::disk('local')->assertMissing($path);
    }

    public function test_only_announcement_managers_attach_and_organizations_stay_apart(): void
    {
        Storage::fake('local');
        config(['sailix.documents.disk' => 'local']);
        $this->setUpTwoOrganizations();
        $id = $this->create('adminA')->json('data.id');

        $this->attach('crewA', $id)->assertForbidden();
        $this->attach('adminB', $id)->assertNotFound();
        $this->get('/api/v1/announcements/'.$id.'/file', $this->as('crewB') + ['Accept' => 'application/json'])->assertNotFound();
    }
}

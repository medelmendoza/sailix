<?php

namespace Tests\Isolation;

use App\Enums\MembershipStatus;
use App\Enums\ModuleStatus;
use App\Enums\Role;
use App\Enums\TenantStatus;
use App\Models\Announcement;
use App\Models\CallItReport;
use App\Models\CrewDocument;
use App\Models\CrewProfile;
use App\Models\DocumentAssignment;
use App\Models\DocumentType;
use App\Models\Membership;
use App\Models\Payslip;
use App\Models\Tenant;
use App\Models\TenantDomain;
use App\Models\TenantModule;
use App\Models\Todo;
use App\Modules\Module;
use Database\Seeders\CrewPortalDemoSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Tries to reach ORGANIZATION B's records from ORGANIZATION A, through every route that takes an identifier. A foreign
 * record must look exactly like a missing one (404): never readable, never changeable, never even confirmed to exist.
 * It also fails when a route with an identifier is added without being listed here, so isolation is decided for every
 * new route, not assumed.
 */
class TenantRouteSweepTest extends TestCase
{
    private Tenant $a;

    private Tenant $b;

    /** @var array<string, string> B's records by the name of the route parameter */
    private array $b_ids = [];

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        config(['sailix.documents.disk' => 'local']);
        $this->app['url']->forceRootUrl('http://localhost');

        $this->a = $this->makeTenant('AAA');
        $this->b = $this->makeTenant('BBB');
        foreach ([$this->a, $this->b] as $t) {
            (new TenantModule)->forceFill(['tenant_id' => $t->id, 'module' => Module::CallIt, 'status' => ModuleStatus::Enabled])->save();
        }
        $this->makeMember($this->a, Role::TenantAdmin, 'adminA');
        $this->makeMember($this->a, Role::Crew, 'crewA');
        $this->makeMember($this->b, Role::TenantAdmin, 'adminB');
        [, $crewB] = $this->makeMember($this->b, Role::Crew, 'crewB');
        $adminB = Membership::withoutTenantScope()->where('tenant_id', $this->b->id)->where('role', Role::TenantAdmin)->firstOrFail();
        $t = $this->b->id;

        $type = (new DocumentType)->forceFill(['tenant_id' => $t, 'name' => 'Passport B', 'short_name' => null, 'is_active' => true]);
        $type->save();
        $this->b_ids = [
            'membership' => $crewB->id,
            'documentType' => $type->id,
            'todo' => $this->save((new Todo)->forceFill(['tenant_id' => $t, 'membership_id' => $crewB->id, 'description' => 'B-only task', 'is_done' => false]))->id,
            'announcement' => $this->save((new Announcement)->forceFill(['tenant_id' => $t, 'created_by_membership_id' => $adminB->id, 'title' => 'B-only news', 'body' => 'x', 'is_active' => true]))->id,
            'document' => $this->save((new CrewDocument)->forceFill([
                'tenant_id' => $t, 'membership_id' => $crewB->id, 'document_type_id' => $type->id, 'status' => 'pending', 'number' => 'B-1',
                'file_disk' => 'local', 'file_path' => 'x', 'file_original_name' => 'x.pdf', 'file_mime' => 'application/pdf', 'file_size' => 1, 'submitted_at' => now(),
            ]))->id,
            'payslip' => $this->save((new Payslip)->forceFill([
                'tenant_id' => $t, 'membership_id' => $crewB->id, 'kind' => 'regular', 'pay_date' => '2026-09-30', 'period_label' => 'September 2026',
                'vessel_name' => 'MV B', 'is_dollar' => false, 'pay_peso' => '1.00', 'net_amount' => '1.00', 'deductions_total' => '0.00',
            ]))->id,
            'report' => $this->save((new CallItReport)->forceFill(['tenant_id' => $t, 'membership_id' => $crewB->id, 'status' => 'submitted', 'details' => 'B-only report', 'submitted_at' => now()]))->id,
            'domain' => $this->save((new TenantDomain)->forceFill(['tenant_id' => $t, 'domain' => 'b.example.com', 'verification_token' => 'sx-1']))->id,
        ];
    }

    private function save($model)
    {
        $model->save();

        return $model;
    }

    /**
     * Every route with an identifier that names a record: how to call it as organization A with B's id.
     * [method, uri, who, body]. `{kind}`, `{module}`, `{slug}` are not records of an organization and are covered by their own tests.
     *
     * @return list<array{0: string, 1: string, 2: string, 3: array<string, mixed>}>
     */
    private function probes(): array
    {
        return [
            ['PATCH', 'tenant/todos/{todo}', 'adminA', ['description' => 'hijack']],
            ['DELETE', 'tenant/todos/{todo}', 'adminA', []],
            ['PATCH', 'todos/{todo}', 'crewA', ['is_done' => true]],
            ['PATCH', 'tenant/announcements/{announcement}', 'adminA', ['title' => 'hijack']],
            ['DELETE', 'tenant/announcements/{announcement}', 'adminA', []],
            ['POST', 'tenant/announcements/{announcement}/attachment', 'adminA', []],
            ['DELETE', 'tenant/announcements/{announcement}/attachment', 'adminA', []],
            ['GET', 'tenant/announcements/{announcement}/file', 'adminA', []],
            ['GET', 'announcements/{announcement}', 'crewA', []],
            ['PUT', 'announcements/{announcement}/read', 'crewA', []],
            ['GET', 'announcements/{announcement}/file', 'crewA', []],
            ['PATCH', 'tenant/document-types/{documentType}', 'adminA', ['name' => 'hijack']],
            ['DELETE', 'tenant/document-types/{documentType}', 'adminA', []],
            ['GET', 'tenant/documents/{document}/file', 'adminA', []],
            ['POST', 'tenant/documents/{document}/approve', 'adminA', []],
            ['POST', 'tenant/documents/{document}/reject', 'adminA', ['reason' => 'no']],
            ['GET', 'documents/{document}', 'crewA', []],
            ['GET', 'documents/{document}/file', 'crewA', []],
            ['POST', 'documents/{document}/resubmit', 'crewA', []],
            ['GET', 'payslips/{payslip}', 'crewA', []],
            ['GET', 'callit/reports/{report}', 'crewA', []],
            ['PATCH', 'callit/reports/{report}', 'crewA', ['details' => 'hijack']],
            ['DELETE', 'callit/reports/{report}', 'crewA', []],
            ['GET', 'callit/reports/{report}/file', 'crewA', []],
            ['POST', 'callit/reports/{report}/file', 'crewA', []],
            ['DELETE', 'callit/reports/{report}/file', 'crewA', []],
            ['GET', 'tenant/callit/reports/{report}/file', 'adminA', []],
            ['POST', 'tenant/callit/reports/{report}/review', 'adminA', []],
            ['PATCH', 'tenant/users/{membership}', 'adminA', ['status' => 'suspended']],
            ['GET', 'tenant/crew/{membership}', 'adminA', []],
            ['PATCH', 'tenant/crew/{membership}', 'adminA', ['rank' => 'hijack']],
            ['GET', 'tenant/crew/{membership}/documents', 'adminA', []],
            ['POST', 'tenant/crew/{membership}/password-reset', 'adminA', []],
            ['PUT', 'tenant/crew/{membership}/document-requests/{documentType}', 'adminA', []],
            ['DELETE', 'tenant/crew/{membership}/document-requests/{documentType}', 'adminA', []],
            ['POST', 'tenant/domains/{domain}/verify', 'adminA', []],
            ['DELETE', 'tenant/domains/{domain}', 'adminA', []],
        ];
    }

    private function probe(string $method, string $uri, string $who, array $body, bool $missing = false)
    {
        foreach ($this->b_ids as $name => $id) {
            // `$missing`: the same call with an id that exists nowhere, to compare what a foreign record looks like
            $uri = str_replace('{'.$name.'}', $missing ? '00000000-0000-7000-8000-000000000000' : $id, $uri);
        }
        $headers = $this->as($who) + ['Accept' => 'application/json'];

        return $this->json($method, '/api/v1/'.$uri, $body, $headers);
    }

    public function test_every_route_that_takes_an_identifier_treats_another_organizations_record_as_missing(): void
    {
        $failures = [];
        foreach ($this->probes() as [$method, $uri, $who, $body]) {
            $foreign = $this->probe($method, $uri, $who, $body)->getStatusCode();
            $missing = $this->probe($method, $uri, $who, $body, true)->getStatusCode();
            // Usually both are 404. A gate that runs before the lookup (a validation rule, the finance lock) may answer both
            // the same way; what must never happen is success, or any difference that confirms the record exists.
            if ($foreign < 400 || $foreign !== $missing) {
                $failures[] = "$who $method /$uri: a foreign record answered $foreign, a missing one $missing";
            }
        }

        $this->assertSame([], $failures, "Another organization's record was not treated as missing:\n".implode("\n", $failures));
    }

    public function test_nothing_of_organization_b_changed_during_the_sweep(): void
    {
        foreach ($this->probes() as [$method, $uri, $who, $body]) {
            $this->probe($method, $uri, $who, $body);
        }

        $this->assertSame('B-only task', Todo::withoutTenantScope()->findOrFail($this->b_ids['todo'])->description);
        $this->assertFalse(Todo::withoutTenantScope()->findOrFail($this->b_ids['todo'])->is_done);
        $this->assertSame('B-only news', Announcement::withoutTenantScope()->findOrFail($this->b_ids['announcement'])->title);
        $this->assertSame('pending', CrewDocument::withoutTenantScope()->findOrFail($this->b_ids['document'])->status);
        $this->assertSame('Passport B', DocumentType::withoutTenantScope()->findOrFail($this->b_ids['documentType'])->name);
        $this->assertSame('submitted', CallItReport::withoutTenantScope()->findOrFail($this->b_ids['report'])->status);
        $this->assertNull(TenantDomain::findOrFail($this->b_ids['domain'])->verified_at);
        $this->assertNull(CrewProfile::withoutTenantScope()->where('membership_id', $this->b_ids['membership'])->value('rank'));
        $this->assertSame(MembershipStatus::Active, Membership::withoutTenantScope()->findOrFail($this->b_ids['membership'])->status);
        $this->assertSame(0, DocumentAssignment::withoutTenantScope()->count());
    }

    public function test_a_route_added_with_an_identifier_must_be_listed_here(): void
    {
        $covered = collect($this->probes())->map(fn ($p) => $p[0].' api/v1/'.$p[1]);
        // identifiers that are not an organization's records: the fixed kinds, module codes, the public slug, and the
        // Tala gateway whose ids belong to Tala (checked by its own tests against the stored link)
        $exempt = collect([
            'GET api/v1/public/tenants/{slug}/logo', 'GET api/v1/public/tenants/{slug}/favicon',
            'GET api/v1/public/tenants/{slug}/login-logo', 'GET api/v1/public/tenants/{slug}/login-background',
            'POST api/v1/tenant/branding/{kind}', 'DELETE api/v1/tenant/branding/{kind}',
            'GET api/v1/tenant/finance/imports/{kind}/template', 'POST api/v1/tenant/finance/imports/{kind}',
            'PUT api/v1/tenant/modules/{module}',
        ]);

        $found = collect(Route::getRoutes()->getRoutes())
            ->filter(fn ($r) => str_starts_with($r->uri(), 'api/v1/') && str_contains($r->uri(), '{')
                && ! str_starts_with($r->uri(), 'api/v1/platform/') && ! str_starts_with($r->uri(), 'api/v1/modules/tala/'))
            ->flatMap(fn ($r) => collect($r->methods())->reject(fn ($m) => $m === 'HEAD')->map(fn ($m) => $m.' '.$r->uri()))
            ->unique()->values();

        $missing = $found->diff($covered)->diff($exempt)->values()->all();
        $stale = $covered->merge($exempt)->diff($found)->values()->all();

        $this->assertSame([], $missing, "Routes with an identifier that this isolation sweep does not cover:\n".implode("\n", $missing));
        $this->assertSame([], $stale, "Entries in the sweep that match no route any more:\n".implode("\n", $stale));
    }

    public function test_lists_never_contain_another_organizations_records(): void
    {
        $marker = ['B-only task', 'B-only news', 'B-only report', 'Passport B', 'b.example.com', 'B-1'];
        $lists = [
            ['adminA', 'tenant/todos'], ['adminA', 'tenant/announcements'], ['adminA', 'tenant/documents'], ['adminA', 'tenant/document-types'],
            ['adminA', 'tenant/users'], ['adminA', 'tenant/crew'], ['adminA', 'tenant/domains'], ['adminA', 'tenant/audit-logs'], ['adminA', 'tenant/feedback'],
            ['adminA', 'tenant/callit/reports'], ['adminA', 'tenant/deletion-requests'], ['adminA', 'tenant/crew/fleets'],
            ['crewA', 'todos'], ['crewA', 'announcements'], ['crewA', 'documents'], ['crewA', 'documents?status=review'], ['crewA', 'document-types'],
            ['crewA', 'document-requests'], ['crewA', 'callit/reports'], ['crewA', 'loans'], ['crewA', 'me'],
        ];

        foreach ($lists as [$who, $uri]) {
            $res = $this->json('GET', '/api/v1/'.$uri, [], $this->as($who) + ['Accept' => 'application/json']);
            $this->assertContains($res->getStatusCode(), [200, 403], "$who GET /$uri answered {$res->getStatusCode()}");
            foreach ($marker as $needle) {
                $this->assertStringNotContainsString($needle, $res->getContent(), "$who GET /$uri shows organization B's \"$needle\"");
            }
            foreach ($this->b_ids as $id) {
                $this->assertStringNotContainsString($id, $res->getContent(), "$who GET /$uri shows one of organization B's ids");
            }
        }
    }

    public function test_a_tenant_id_in_the_request_never_places_or_moves_a_record(): void
    {
        $body = ['tenant_id' => $this->b->id, 'created_by_membership_id' => $this->b_ids['membership']];

        $todo = $this->json('POST', '/api/v1/tenant/todos', $body + ['description' => 'mine', 'membership_ids' => [Membership::withoutTenantScope()->where('tenant_id', $this->a->id)->where('role', Role::Crew)->value('id')]], $this->as('adminA'))->assertCreated();
        $this->assertSame($this->a->id, Todo::withoutTenantScope()->findOrFail($todo->json('data.0.id'))->tenant_id);

        $news = $this->json('POST', '/api/v1/tenant/announcements', $body + ['title' => 'mine', 'body' => 'x'], $this->as('adminA'))->assertCreated();
        $row = Announcement::withoutTenantScope()->findOrFail($news->json('data.id'));
        $this->assertSame($this->a->id, $row->tenant_id);
        $this->assertNotSame($this->b_ids['membership'], $row->created_by_membership_id);

        $type = $this->json('POST', '/api/v1/tenant/document-types', $body + ['name' => 'Visa A'], $this->as('adminA'))->assertCreated();
        $this->assertSame($this->a->id, DocumentType::withoutTenantScope()->findOrFail($type->json('data.id'))->tenant_id);

        $this->json('PATCH', '/api/v1/tenant/announcements/'.$news->json('data.id'), ['tenant_id' => $this->b->id, 'title' => 'renamed'], $this->as('adminA'))->assertOk();
        $this->assertSame($this->a->id, Announcement::withoutTenantScope()->findOrFail($news->json('data.id'))->tenant_id); // not moved
    }

    public function test_ids_of_another_organization_inside_a_body_are_refused_as_a_whole(): void
    {
        $crewA = Membership::withoutTenantScope()->where('tenant_id', $this->a->id)->where('role', Role::Crew)->value('id');

        $this->json('POST', '/api/v1/tenant/todos', ['description' => 'x', 'membership_ids' => [$crewA, $this->b_ids['membership']]], $this->as('adminA'))->assertStatus(422);
        $this->assertSame(0, Todo::withoutTenantScope()->where('tenant_id', $this->a->id)->count()); // nothing created, not even for A's own member

        $this->actingAsCrewSubmit(['document_type_id' => $this->b_ids['documentType']])->assertStatus(422); // B's document type
    }

    private function actingAsCrewSubmit(array $body)
    {
        $png = UploadedFile::fake()->createWithContent('p.pdf', CrewPortalDemoSeeder::pdf('x'));

        return $this->post('/api/v1/documents', $body + ['file' => $png], $this->as('crewA') + ['Accept' => 'application/json']);
    }

    public function test_the_other_organizations_credentials_and_tokens_open_nothing_here(): void
    {
        // B's token carries B's membership: on every A-only route it is B's data it would reach, never A's
        $bToken = $this->tokenFor('adminB');
        $this->app['auth']->forgetGuards();
        $todos = $this->json('GET', '/api/v1/tenant/todos', [], $this->bearer($bToken))->assertOk();
        $this->assertSame(['B-only task'], array_column($todos->json('data'), 'description'));

        // an A-address request with B's token is refused (see TenantAddressingTest for the full matrix)
        $this->app['auth']->forgetGuards();
        $this->json('GET', 'http://aaa.sailix.test/api/v1/tenant/todos', [], $this->bearer($bToken) + ['Accept' => 'application/json'])->assertUnauthorized();

        // a made-up or foreign hint can never choose the data
        $this->app['auth']->forgetGuards();
        $this->json('GET', '/api/v1/tenant/todos', [], $this->bearer($bToken) + ['X-Tenant-Hint' => $this->a->id])->assertStatus(409);
    }

    public function test_the_superadmin_api_and_platform_routes_are_closed_to_organization_admins(): void
    {
        $headers = $this->as('adminA') + ['Accept' => 'application/json'];

        foreach (['GET platform/tenants', 'POST platform/tenants', 'GET platform/settings', 'GET platform/audit-logs',
            'GET platform/tenants/'.$this->b->id, 'PATCH platform/tenants/'.$this->b->id, 'GET platform/tenants/'.$this->b->id.'/branding',
            'POST platform/tenants/'.$this->b->id.'/domains', 'POST platform/tenants/'.$this->b->id.'/suspend'] as $call) {
            [$method, $uri] = explode(' ', $call);
            $status = $this->json($method, '/api/v1/'.$uri, [], $headers)->getStatusCode();
            $this->assertContains($status, [401, 403, 404], "$call answered $status to an organization administrator");
        }
        $this->assertSame(TenantStatus::Active, $this->b->refresh()->status);
    }

    public function test_crew_cannot_use_administrator_routes_of_their_own_organization_either(): void
    {
        $headers = $this->as('crewA') + ['Accept' => 'application/json'];

        foreach (['GET tenant/users', 'GET tenant/crew', 'GET tenant/todos', 'GET tenant/documents', 'GET tenant/announcements',
            'GET tenant/domains', 'GET tenant/branding', 'GET tenant/audit-logs', 'GET tenant/callit/reports'] as $call) {
            [$method, $uri] = explode(' ', $call);
            $this->assertSame(403, $this->json($method, '/api/v1/'.$uri, [], $headers)->getStatusCode(), $call);
        }
    }
}

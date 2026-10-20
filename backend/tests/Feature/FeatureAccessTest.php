<?php

namespace Tests\Feature;

use App\Enums\Feature;
use App\Enums\Role;
use App\Models\AuditLog;
use App\Models\Tenant;
use App\Support\Tenancy\TenantContext;
use Tests\TestCase;

class FeatureAccessTest extends TestCase
{
    private function platformAdmin(): void
    {
        [, $secret] = $this->makePlatformAdmin();
        $r = $this->spa()->postJson('/api/v1/platform/auth/session', ['email' => 'root@example.test', 'password' => self::PASSWORD, 'otp' => $this->otp($secret)])->assertOk();
        $this->carrySession($r);
        $this->app['auth']->forgetGuards();
    }

    private function setUpOrganizations(): array
    {
        $a = $this->makeTenant('AAA');
        $b = $this->makeTenant('BBB');
        foreach ([$a, $b] as $t) {
            $this->makeMember($t, Role::TenantAdmin, 'admin'.$t->code);
            $this->makeMember($t, Role::Crew, 'crew'.$t->code);
        }

        return [$a, $b];
    }

    public function test_every_feature_is_on_by_default_and_me_says_so(): void
    {
        $this->setUpOrganizations();

        $features = $this->getJson('/api/v1/me', $this->as('crewAAA'))->assertOk()->json('data.feature_access');
        $this->assertSame(array_map(fn (Feature $f) => $f->value, Feature::cases()), array_keys($features));
        $this->assertNotContains(false, $features);
        $this->getJson('/api/v1/tenant/crew', $this->as('adminAAA'))->assertOk();
    }

    public function test_the_superadmin_switches_features_off_and_on_for_one_organization_only(): void
    {
        [$a, $b] = $this->setUpOrganizations();
        $this->platformAdmin();

        $r = $this->spa()->patchJson("/api/v1/platform/tenants/{$a->id}/features", ['features' => ['crew' => false, 'announcements' => false]])->assertOk();
        $byCode = collect($r->json('data'))->pluck('enabled', 'code');
        $this->assertFalse($byCode['crew']);
        $this->assertFalse($byCode['announcements']);
        $this->assertTrue($byCode['documents']);
        $this->assertSame(['announcements', 'crew'], $a->refresh()->disabled_features);
        $this->assertNull($b->refresh()->disabled_features);
        app(TenantContext::class)->markPlatform();
        $this->assertSame(1, AuditLog::where('action', 'tenant.features_changed')->count());

        $this->spa()->patchJson("/api/v1/platform/tenants/{$a->id}/features", ['features' => ['crew' => true]])->assertOk();
        $this->assertSame(['announcements'], $a->refresh()->disabled_features);
        $this->spa()->patchJson("/api/v1/platform/tenants/{$a->id}/features", ['features' => ['announcements' => true]])->assertOk();
        $this->assertNull($a->refresh()->disabled_features);
    }

    public function test_unknown_features_and_non_booleans_are_refused(): void
    {
        [$a] = $this->setUpOrganizations();
        $this->platformAdmin();

        $this->spa()->patchJson("/api/v1/platform/tenants/{$a->id}/features", ['features' => ['nonsense' => false]])->assertStatus(422)->assertJsonValidationErrors('features.nonsense');
        $this->spa()->patchJson("/api/v1/platform/tenants/{$a->id}/features", ['features' => ['crew' => 'maybe']])->assertStatus(422);
        $this->spa()->patchJson("/api/v1/platform/tenants/{$a->id}/features", [])->assertStatus(422);
    }

    public function test_a_switched_off_feature_is_refused_by_the_api_for_that_organization_but_not_for_another(): void
    {
        [$a, $b] = $this->setUpOrganizations();
        $a->forceFill(['disabled_features' => ['crew', 'announcements', 'documents', 'finance', 'feedback', 'todos', 'branding']])->save();

        $refused = [
            ['get', '/api/v1/tenant/crew', 'adminAAA'],
            ['get', '/api/v1/tenant/announcements', 'adminAAA'],
            ['get', '/api/v1/announcements', 'crewAAA'],
            ['get', '/api/v1/documents', 'crewAAA'],
            ['get', '/api/v1/document-types', 'crewAAA'],
            ['get', '/api/v1/tenant/documents', 'adminAAA'],
            ['get', '/api/v1/payslips', 'crewAAA'],
            ['get', '/api/v1/tenant/feedback', 'adminAAA'],
            ['get', '/api/v1/todos', 'crewAAA'],
            ['get', '/api/v1/tenant/branding', 'adminAAA'],
            ['get', '/api/v1/tenant/domains', 'adminAAA'],
        ];
        foreach ($refused as [$verb, $url, $who]) {
            $this->{$verb.'Json'}($url, $this->as($who))->assertForbidden()->assertJsonPath('code', 'feature_disabled');
        }
        // the same routes still work for the other organization
        $this->getJson('/api/v1/tenant/crew', $this->as('adminBBB'))->assertOk();
        $this->getJson('/api/v1/announcements', $this->as('crewBBB'))->assertOk();
        // me, modules and the rest of the portal are untouched
        $me = $this->getJson('/api/v1/me', $this->as('crewAAA'))->assertOk();
        $this->assertNotContains(true, $me->json('data.feature_access'));
        $this->getJson('/api/v1/tenant', $this->as('adminAAA'))->assertOk();
    }

    public function test_only_the_superadmin_reaches_the_switches(): void
    {
        [$a] = $this->setUpOrganizations();

        $this->spa()->getJson("/api/v1/platform/tenants/{$a->id}/features")->assertUnauthorized();
        $this->getJson("/api/v1/platform/tenants/{$a->id}/features", $this->as('adminAAA'))->assertUnauthorized();
        $this->assertInstanceOf(Tenant::class, $a);
    }
}

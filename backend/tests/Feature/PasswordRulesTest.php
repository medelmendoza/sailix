<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Identity\PasswordRules;
use App\Models\Tenant;
use App\Support\Settings\SettingsRegistry;
use App\Support\Tenancy\TenantContext;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;
use Tests\TestCase;

class PasswordRulesTest extends TestCase
{
    private function passes(Password $rule, string $password): bool
    {
        return Validator::make(['p' => $password], ['p' => [$rule]])->passes();
    }

    private function minimum(Password $rule): int
    {
        return (fn () => $this->min)->call($rule);
    }

    private function raise(Tenant $tenant, int $min): void
    {
        [, $m] = $this->makeMember($tenant, Role::TenantAdmin, 'admin'.$tenant->code);
        app(TenantContext::class)->runAs($tenant->id, $m->id, $m->user_id, Role::TenantAdmin, fn () => SettingsRegistry::setTenant('password_min_length', $min));
    }

    public function test_the_platform_floor_applies_when_no_organization_is_involved(): void
    {
        $rule = PasswordRules::forTenantIds([]);

        $this->assertFalse($this->passes($rule, str_repeat('a', 7)));
        $this->assertTrue($this->passes($rule, str_repeat('a', 8)));
        foreach ([PasswordRules::forAgencyCode('NOPE'), PasswordRules::forEmail('nobody@example.test'), PasswordRules::forUser(null)] as $other) {
            $this->assertSame(8, $this->minimum($other), 'unknown organization/email/user ⇒ platform floor');
        }
    }

    public function test_a_raised_platform_floor_applies_everywhere(): void
    {
        SettingsRegistry::setPlatform('password_min_length', 10);

        $this->assertFalse($this->passes(PasswordRules::forTenantIds([]), str_repeat('a', 9)));
        $this->assertTrue($this->passes(PasswordRules::forTenantIds([]), str_repeat('a', 10)));
    }

    public function test_an_organization_can_raise_the_minimum_and_a_user_gets_the_strictest_of_their_organizations(): void
    {
        $strict = $this->makeTenant('STRICT');
        $stricter = $this->makeTenant('STRICTER');
        $plain = $this->makeTenant('PLAIN');
        $this->raise($strict, 12);
        $this->raise($stricter, 16);

        $this->assertFalse($this->passes(PasswordRules::forAgencyCode('strict'), str_repeat('a', 11)));
        $this->assertTrue($this->passes(PasswordRules::forAgencyCode('STRICT'), str_repeat('a', 12)));
        $this->assertTrue($this->passes(PasswordRules::forAgencyCode('PLAIN'), str_repeat('a', 8)));

        $user = $this->makeUser('multi');
        $this->makeMembership($strict, $user);
        $this->makeMembership($stricter, $user);
        $this->makeMembership($plain, $user);

        $this->assertFalse($this->passes(PasswordRules::forUser($user), str_repeat('a', 15)));
        $this->assertTrue($this->passes(PasswordRules::forUser($user), str_repeat('a', 16)));
        $this->assertFalse($this->passes(PasswordRules::forEmail('multi@example.test'), str_repeat('a', 15)));
    }
}

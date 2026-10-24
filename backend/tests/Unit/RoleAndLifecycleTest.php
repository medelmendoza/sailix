<?php

namespace Tests\Unit;

use App\Enums\Role;
use App\Enums\TenantStatus as S;
use App\Modules\Module;
use App\Platform\TenantTransition as T;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class RoleAndLifecycleTest extends TestCase
{
    /** @return array<string, array{T, S, bool}> */
    public static function matrix(): array
    {
        $legal = [
            [T::Activate, S::Provisioning], [T::Suspend, S::Active], [T::Reactivate, S::Suspended], [T::Reactivate, S::Deactivated],
            [T::Deactivate, S::Active], [T::Deactivate, S::Suspended], [T::Archive, S::Deactivated],
        ];
        $cases = [];
        foreach (T::cases() as $t) {
            foreach (S::cases() as $s) {
                $isLegal = collect($legal)->contains(fn ($l) => $l[0] === $t && $l[1] === $s);
                $cases["{$t->value} from {$s->value}"] = [$t, $s, $isLegal];
            }
        }

        return $cases;
    }

    #[DataProvider('matrix')]
    public function test_transition_matrix(T $transition, S $from, bool $legal): void
    {
        $this->assertSame($legal, in_array($from, $transition->allowedFrom(), true));
    }

    public function test_archived_is_terminal_and_only_active_grants_access(): void
    {
        foreach (T::cases() as $t) {
            $this->assertNotContains(S::Archived, $t->allowedFrom());
            $this->assertSame($t->to() !== S::Active, $t->revokesAccess());
        }
    }

    public function test_destructive_transitions_require_a_reason(): void
    {
        $this->assertTrue(T::Suspend->requiresReason());
        $this->assertTrue(T::Deactivate->requiresReason());
        $this->assertTrue(T::Archive->requiresReason());
        $this->assertFalse(T::Activate->requiresReason());
        $this->assertFalse(T::Reactivate->requiresReason());
    }

    public function test_role_abilities(): void
    {
        $this->assertTrue(Role::TenantAdmin->can('users.manage'));
        $this->assertFalse(Role::Crew->can('users.manage'));
        // Crew holds ONLY module-use abilities (approved M1 change); no admin/manage abilities.
        $this->assertSame(Module::useAbilities(), Role::Crew->abilities());
        $this->assertFalse(Role::Crew->can('tenant.manage'));
        $this->assertFalse(Role::Crew->can('module.tala.manage'));
        $this->assertTrue(Role::TenantAdmin->can('module.tala.manage'));
        $this->assertGreaterThan(Role::Crew->rank(), Role::TenantAdmin->rank());
        $this->assertTrue(Role::TenantAdmin->canUseWeb());
        $this->assertTrue(Role::Crew->canUseWeb()); // the client portal
    }

    public function test_no_role_grants_platform_abilities(): void
    {
        foreach (Role::cases() as $role) {
            foreach ($role->abilities() as $ability) {
                $this->assertStringNotContainsString('platform', $ability);
            }
        }
    }
}

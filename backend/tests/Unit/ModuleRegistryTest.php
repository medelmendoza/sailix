<?php

namespace Tests\Unit;

use App\Enums\Role;
use App\Modules\Module;
use PHPUnit\Framework\TestCase;

class ModuleRegistryTest extends TestCase
{
    public function test_every_module_has_consistent_abilities_in_the_role_map(): void
    {
        foreach (Module::cases() as $module) {
            $this->assertSame("module.{$module->value}.use", $module->useAbility());
            $this->assertSame("module.{$module->value}.manage", $module->manageAbility());
            $this->assertNotSame('', $module->label());

            // crew may use, never manage; admin may do both
            $this->assertTrue(Role::Crew->can($module->useAbility()));
            $this->assertFalse(Role::Crew->can($module->manageAbility()));
            $this->assertTrue(Role::TenantAdmin->can($module->useAbility()));
            $this->assertTrue(Role::TenantAdmin->can($module->manageAbility()));
        }
    }

    public function test_the_registry_lists_tala_and_the_built_in_services(): void
    {
        $this->assertSame(['tala', 'astra', 'callit'], array_map(fn (Module $m) => $m->value, Module::cases()));
    }

    public function test_only_tala_talks_to_an_upstream_system(): void
    {
        foreach (Module::cases() as $module) {
            $this->assertSame($module === Module::Tala, $module->requiresEndpoint(), $module->value);
        }
    }

    public function test_abilities_are_unique_and_no_role_gets_platform_abilities(): void
    {
        foreach (Role::cases() as $role) {
            $this->assertSame($role->abilities(), array_values(array_unique($role->abilities())));
            foreach ($role->abilities() as $ability) {
                $this->assertStringNotContainsString('platform', $ability);
            }
        }
    }
}

<?php

namespace App\Enums;

/**
 * Tenant-level roles (docs/04, ADR-0005). Superadmin is NOT a role: it is a separate
 * identity (PlatformAdmin) on a separate guard.
 */
enum Role: string
{
    case TenantAdmin = 'tenant_admin';
    case Crew = 'crew';

    /** Higher rank may manage lower or equal-rank roles it is allowed to grant. */
    public function rank(): int
    {
        return match ($this) {
            self::TenantAdmin => 100,
            self::Crew => 10,
        };
    }

    public function canUseWeb(): bool
    {
        return $this === self::TenantAdmin;
    }

    /** @return list<string> */
    public function abilities(): array
    {
        return match ($this) {
            self::TenantAdmin => [
                'tenant.view', 'tenant.manage', 'users.view', 'users.manage', 'audit.view',
            ],
            self::Crew => [],
        };
    }

    public function can(string $ability): bool
    {
        return in_array($ability, $this->abilities(), true);
    }
}

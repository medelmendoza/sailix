<?php

namespace App\Platform;

use App\Enums\TenantStatus as S;

/** Tenant lifecycle state machine (docs/02 §3). */
enum TenantTransition: string
{
    case Activate = 'activate';
    case Suspend = 'suspend';
    case Reactivate = 'reactivate';
    case Deactivate = 'deactivate';
    case Archive = 'archive';

    /** @return list<S> */
    public function allowedFrom(): array
    {
        return match ($this) {
            self::Activate => [S::Provisioning],
            self::Suspend => [S::Active],
            self::Reactivate => [S::Suspended, S::Deactivated],
            self::Deactivate => [S::Active, S::Suspended],
            self::Archive => [S::Deactivated],
        };
    }

    public function to(): S
    {
        return match ($this) {
            self::Activate, self::Reactivate => S::Active,
            self::Suspend => S::Suspended,
            self::Deactivate => S::Deactivated,
            self::Archive => S::Archived,
        };
    }

    public function requiresReason(): bool
    {
        return in_array($this, [self::Suspend, self::Deactivate, self::Archive], true);
    }

    /** Tenant access must stop immediately: revoke every token of the tenant. */
    public function revokesAccess(): bool
    {
        return $this->to() !== S::Active;
    }
}

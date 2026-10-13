<?php

namespace App\Support\Tenancy;

use App\Enums\Role;
use Closure;

/**
 * Request/job-scoped, immutable-once-set tenant context (docs/03 §4).
 * Registered with scoped(); the container discards it between requests/jobs.
 * Established ONLY from a validated membership, never from client input.
 */
class TenantContext
{
    private ?string $tenantId = null;

    private ?string $membershipId = null;

    private ?string $userId = null;

    private ?Role $role = null;

    private bool $platform = false;

    public function set(string $tenantId, string $membershipId, string $userId, Role $role): void
    {
        if ($this->platform) {
            throw new \LogicException('Platform context cannot also carry a tenant context.');
        }
        if ($this->tenantId !== null) {
            throw new \LogicException('Tenant context is already set and is immutable.');
        }
        $this->tenantId = $tenantId;
        $this->membershipId = $membershipId;
        $this->userId = $userId;
        $this->role = $role;
    }

    public function markPlatform(): void
    {
        if ($this->tenantId !== null) {
            throw new \LogicException('Tenant context cannot also be a platform context.');
        }
        $this->platform = true;
    }

    public function has(): bool
    {
        return $this->tenantId !== null;
    }

    public function isPlatform(): bool
    {
        return $this->platform;
    }

    public function tenantId(): string
    {
        return $this->tenantId ?? throw new MissingTenantContext('No tenant context is established.');
    }

    public function membershipId(): string
    {
        return $this->membershipId ?? throw new MissingTenantContext('No tenant context is established.');
    }

    public function userId(): string
    {
        return $this->userId ?? throw new MissingTenantContext('No tenant context is established.');
    }

    public function role(): Role
    {
        return $this->role ?? throw new MissingTenantContext('No tenant context is established.');
    }

    public function clear(): void
    {
        $this->tenantId = $this->membershipId = $this->userId = $this->role = null;
        $this->platform = false;
    }

    /**
     * Run code (jobs, seeders, tests, console) as a tenant. The tenant/membership must already
     * have been validated by the caller; HTTP code must never use this.
     *
     * @template T
     *
     * @param  Closure(): T  $callback
     * @return T
     */
    public function runAs(string $tenantId, string $membershipId, string $userId, Role $role, Closure $callback): mixed
    {
        $previous = [$this->tenantId, $this->membershipId, $this->userId, $this->role, $this->platform];
        $this->clear();
        $this->set($tenantId, $membershipId, $userId, $role);
        try {
            return $callback();
        } finally {
            [$this->tenantId, $this->membershipId, $this->userId, $this->role, $this->platform] = $previous;
        }
    }
}

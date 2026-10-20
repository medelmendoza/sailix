<?php

namespace App\Tenancy;

use App\Models\Tenant;
use App\Support\ApiProblem;

/**
 * The organization the request ADDRESSES (from its host, see TenantAddress), if any. This only says whose sign-in page
 * or branding is being asked for. It is not authorization: the credential still decides what a caller may do, and it
 * must belong to this same organization. Registered with scoped(), so it never outlives a request.
 */
final class AddressedTenant
{
    private ?Tenant $tenant = null;

    public function set(?Tenant $tenant): void
    {
        $this->tenant = $tenant;
    }

    public function get(): ?Tenant
    {
        return $this->tenant;
    }

    public function has(): bool
    {
        return $this->tenant !== null;
    }

    /**
     * The agency code a sign-in or registration is for. On an organization's own address the address decides, and an agency
     * code naming a different organization is refused instead of silently ignored.
     */
    public function agencyCodeFor(?string $supplied): ?string
    {
        $supplied = $supplied !== null && trim($supplied) !== '' ? trim($supplied) : null;
        if ($this->tenant === null) {
            return $supplied;
        }
        if ($supplied !== null && strtoupper($supplied) !== strtoupper($this->tenant->code)) {
            throw new ApiProblem(422, 'tenant_mismatch', 'This address belongs to a different organization than the agency code.', ['agency_code' => ['The agency code does not match this address.']]);
        }

        return $this->tenant->code;
    }
}

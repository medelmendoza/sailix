<?php

namespace App\Tenancy;

use App\Models\Tenant;
use App\Models\TenantDomain;
use App\Support\ApiProblem;
use App\Support\Audit;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * The domains an organization may be reached on. A domain starts unverified and routes nothing. The organization proves
 * it controls the domain by publishing a DNS TXT record with a token; only then does the domain route traffic. A verified
 * domain belongs to one organization; someone else's unverified claim gives no rights, whoever proves DNS ownership wins.
 */
final class TenantDomainService
{
    public const MAX_PER_TENANT = 10;

    public function add(Tenant $tenant, string $raw): TenantDomain
    {
        $domain = DomainNormalizer::normalize($raw);
        if ($domain === null || ! DomainNormalizer::isRegistrable($domain)) {
            throw ApiProblem::invalid('invalid_domain', 'Enter a domain name you own, such as school.example.com.');
        }
        $base = DomainNormalizer::normalize((string) config('sailix.tenancy.base_domain'));
        if ($base !== null && ($domain === $base || str_ends_with($domain, '.'.$base))) {
            throw ApiProblem::invalid('reserved_domain', 'Addresses under the Sailix domain are assigned automatically.');
        }
        if (TenantDomain::where('verified_domain', $domain)->exists()) {
            throw ApiProblem::conflict('domain_taken', 'That domain already belongs to an organization.');
        }
        if (TenantDomain::where('tenant_id', $tenant->getKey())->where('domain', $domain)->exists()) {
            throw ApiProblem::conflict('domain_exists', 'That domain is already on your list.');
        }
        if (TenantDomain::where('tenant_id', $tenant->getKey())->count() >= self::MAX_PER_TENANT) {
            throw ApiProblem::conflict('too_many_domains', 'Remove a domain before adding another.');
        }

        $row = (new TenantDomain)->forceFill([
            'tenant_id' => $tenant->getKey(), 'domain' => $domain, 'verification_token' => 'sx-'.bin2hex(random_bytes(16)),
        ]);
        $row->save();
        Audit::record('tenant.domain_added', $tenant->getKey(), $tenant, ['domain' => $domain]);

        return $row;
    }

    public function verify(TenantDomain $row): TenantDomain
    {
        if ($row->isVerified()) {
            return $row;
        }
        $name = config('sailix.tenancy.challenge_prefix').'.'.$row->domain;
        if (! in_array($row->verification_token, app(DomainVerifier::class)->txtRecords($name), true)) {
            throw ApiProblem::invalid('verification_failed', "We could not find the record yet. Publish a TXT record named $name with the value below, wait a few minutes, and try again.");
        }

        try {
            DB::transaction(function () use ($row): void {
                $row->forceFill(['verified_at' => now(), 'verified_domain' => $row->domain])->save(); // unique: one owner
                TenantDomain::where('domain', $row->domain)->where('tenant_id', '!=', $row->tenant_id)->whereNull('verified_at')->delete();
            });
        } catch (QueryException) {
            throw ApiProblem::conflict('domain_taken', 'That domain was just verified by another organization.');
        }
        Audit::record('tenant.domain_verified', $row->tenant_id, $row, ['domain' => $row->domain]);

        return $row->refresh();
    }

    public function remove(TenantDomain $row): void
    {
        $row->delete();
        Audit::record('tenant.domain_removed', $row->tenant_id, $row, ['domain' => $row->domain]);
    }

    /** What the organization has to do, shown beside the domain. @return array<string, mixed> */
    public function describe(TenantDomain $row): array
    {
        $base = (string) config('sailix.tenancy.base_domain');

        return [
            'id' => $row->id,
            'domain' => $row->domain,
            'verified' => $row->isVerified(),
            'verified_at' => $row->verified_at?->toIso8601String(),
            'txt_name' => config('sailix.tenancy.challenge_prefix').'.'.$row->domain,
            'txt_value' => $row->isVerified() ? null : $row->verification_token,
            // after verification the customer also points the domain at the deployment
            'cname_target' => $row->tenant->slug.'.'.$base,
        ];
    }
}

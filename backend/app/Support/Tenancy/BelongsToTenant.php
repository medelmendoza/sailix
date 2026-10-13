<?php

namespace App\Support\Tenancy;

use App\Models\Tenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Marks a model as tenant-owned (docs/03 §3-4):
 *  - fail-closed global scope;
 *  - tenant_id stamped from the context on create, a conflicting value is rejected;
 *  - tenant_id is never mass-assignable (do not add it to #[Fillable]).
 */
trait BelongsToTenant
{
    public static function bootBelongsToTenant(): void
    {
        static::addGlobalScope(new TenantScope);

        static::creating(function ($model): void {
            $context = app(TenantContext::class);
            $explicit = $model->getAttribute('tenant_id');

            if ($context->has()) {
                if ($explicit !== null && $explicit !== $context->tenantId()) {
                    throw new \LogicException('Refusing to create a record for a different tenant than the active context.');
                }
                $model->setAttribute('tenant_id', $context->tenantId());

                return;
            }

            // No context: only allowed when the caller set tenant_id explicitly via forceFill
            // (identity/platform code, e.g. provisioning). HTTP tenant code always has a context.
            if ($explicit === null) {
                throw new MissingTenantContext($model::class.' cannot be created without a tenant context.');
            }
        });
    }

    /** @return BelongsTo<Tenant, $this> */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    /**
     * The single sanctioned bypass. Allowed only under app/Platform and app/Identity
     * (enforced by tests/Unit/TenancyStaticChecksTest).
     *
     * @return Builder<static>
     */
    public static function withoutTenantScope(): Builder
    {
        return static::query()->withoutGlobalScope(TenantScope::class);
    }
}

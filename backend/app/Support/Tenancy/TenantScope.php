<?php

namespace App\Support\Tenancy;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

/** Fail-closed global scope: no tenant context ⇒ exception, never unscoped rows. */
/** @implements Scope<Model> */
class TenantScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        $context = app(TenantContext::class);

        if (! $context->has()) {
            throw new MissingTenantContext(
                $model::class.' was queried without a tenant context. Establish one, or (platform/identity code only) use withoutTenantScope().',
            );
        }

        $builder->where($model->qualifyColumn('tenant_id'), $context->tenantId());
    }
}

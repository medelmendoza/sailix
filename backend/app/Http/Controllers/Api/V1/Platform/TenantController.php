<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Enums\TenantStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\StoreTenantRequest;
use App\Http\Requests\Platform\TransitionRequest;
use App\Http\Requests\Platform\UpdateTenantRequest;
use App\Http\Resources\TenantResource;
use App\Models\Tenant;
use App\Platform\TenantLifecycle;
use App\Platform\TenantTransition;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Auth;

class TenantController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $q = Tenant::query()
            ->when($request->input('filter.status'), fn ($b, $v) => $b->where('status', $v))
            ->when($request->input('filter.q'), function ($b, $v) {
                $like = '%'.addcslashes($v, '%_\\').'%';
                $b->where(fn ($w) => $w->where('code', 'like', $like)->orWhere('name', 'like', $like));
            })
            ->orderBy('name')->orderBy('id');

        return TenantResource::collection($q->paginate(min((int) $request->input('per_page', 20), 100)));
    }

    public function store(StoreTenantRequest $request): JsonResponse
    {
        $tenant = (new Tenant($request->only('code', 'name')));
        $tenant->forceFill(['status' => TenantStatus::Provisioning])->save();
        Audit::record('tenant.created', $tenant->getKey(), $tenant, ['code' => $tenant->code]);

        return (new TenantResource($tenant))->response()->setStatusCode(201);
    }

    public function show(Tenant $tenant): TenantResource
    {
        return new TenantResource($tenant);
    }

    public function update(UpdateTenantRequest $request, Tenant $tenant): TenantResource
    {
        $tenant->update($request->only('name'));
        Audit::record('tenant.updated', $tenant->getKey(), $tenant);

        return new TenantResource($tenant);
    }

    public function transition(TransitionRequest $request, Tenant $tenant, string $action, TenantLifecycle $lifecycle): TenantResource
    {
        $transition = TenantTransition::tryFrom($action) ?? abort(404);

        return new TenantResource(
            $lifecycle->apply($tenant, $transition, $request->input('reason'), Auth::guard('platform')->user()),
        );
    }
}

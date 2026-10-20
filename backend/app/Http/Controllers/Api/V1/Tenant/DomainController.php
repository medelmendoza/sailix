<?php

namespace App\Http\Controllers\Api\V1\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Models\TenantDomain;
use App\Support\ApiProblem;
use App\Support\Tenancy\TenantContext;
use App\Tenancy\TenantDomainService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/** The domains of the administrator's own organization. */
class DomainController extends Controller
{
    public function __construct(private TenantDomainService $domains) {}

    public function index(TenantContext $context): JsonResponse
    {
        Gate::authorize('tenant.manage');
        $tenant = Tenant::findOrFail($context->tenantId());

        return response()->json(['data' => [
            'default_address' => $tenant->slug.'.'.config('sailix.tenancy.base_domain'),
            'slug' => $tenant->slug,
            'domains' => TenantDomain::where('tenant_id', $tenant->getKey())->orderBy('domain')->get()->map(fn ($d) => $this->domains->describe($d))->values(),
        ]]);
    }

    public function store(Request $request, TenantContext $context): JsonResponse
    {
        Gate::authorize('tenant.manage');
        $data = $request->validate(['domain' => ['required', 'string', 'max:253']]);
        $row = $this->domains->add(Tenant::findOrFail($context->tenantId()), $data['domain']);

        return response()->json(['data' => $this->domains->describe($row)], 201);
    }

    public function verify(string $domain, TenantContext $context): JsonResponse
    {
        Gate::authorize('tenant.manage');

        return response()->json(['data' => $this->domains->describe($this->domains->verify($this->own($domain, $context)))]);
    }

    public function destroy(string $domain, TenantContext $context): JsonResponse
    {
        Gate::authorize('tenant.manage');
        $this->domains->remove($this->own($domain, $context));

        return response()->json(null, 204);
    }

    private function own(string $id, TenantContext $context): TenantDomain
    {
        if (! preg_match('/^[0-9a-f-]{36}$/i', $id)) {
            throw ApiProblem::notFound('Domain not found.');
        }

        return TenantDomain::where('tenant_id', $context->tenantId())->whereKey($id)->first() ?? throw ApiProblem::notFound('Domain not found.');
    }
}

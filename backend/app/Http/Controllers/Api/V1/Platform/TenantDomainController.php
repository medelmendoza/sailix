<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Models\TenantDomain;
use App\Support\ApiProblem;
use App\Tenancy\TenantDomainService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** The superadmin manages the domains of any organization (same rules as the organization's own administrators). */
class TenantDomainController extends Controller
{
    public function __construct(private TenantDomainService $domains) {}

    public function index(Tenant $tenant): JsonResponse
    {
        return response()->json(['data' => [
            'default_address' => $tenant->slug.'.'.config('sailix.tenancy.base_domain'),
            'slug' => $tenant->slug,
            'domains' => TenantDomain::where('tenant_id', $tenant->getKey())->orderBy('domain')->get()->map(fn ($d) => $this->domains->describe($d))->values(),
        ]]);
    }

    public function store(Request $request, Tenant $tenant): JsonResponse
    {
        $data = $request->validate(['domain' => ['required', 'string', 'max:253']]);

        return response()->json(['data' => $this->domains->describe($this->domains->add($tenant, $data['domain']))], 201);
    }

    public function verify(Tenant $tenant, string $domain): JsonResponse
    {
        return response()->json(['data' => $this->domains->describe($this->domains->verify($this->of($tenant, $domain)))]);
    }

    public function destroy(Tenant $tenant, string $domain): JsonResponse
    {
        $this->domains->remove($this->of($tenant, $domain));

        return response()->json(null, 204);
    }

    private function of(Tenant $tenant, string $id): TenantDomain
    {
        if (! preg_match('/^[0-9a-f-]{36}$/i', $id)) {
            throw ApiProblem::notFound('Domain not found.');
        }

        return TenantDomain::where('tenant_id', $tenant->getKey())->whereKey($id)->first() ?? throw ApiProblem::notFound('Domain not found.');
    }
}

<?php

namespace App\Http\Controllers\Api\V1\Tenant;

use App\Http\Controllers\Controller;
use App\Http\Requests\Tenant\BrandingImageRequest;
use App\Http\Requests\Tenant\BrandingRequest;
use App\Models\Tenant;
use App\Support\ApiProblem;
use App\Support\Tenancy\TenantContext;
use App\Tenancy\BrandingImages;
use App\Tenancy\TenantBrandingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/** An organization's administrators set how it looks. The organization is the session's, never a parameter. */
class BrandingController extends Controller
{
    public function show(TenantBrandingService $branding, TenantContext $context): JsonResponse
    {
        Gate::authorize('tenant.manage');

        return response()->json(['data' => $branding->adminPayload($this->tenant($context))]);
    }

    public function update(BrandingRequest $request, TenantBrandingService $branding, TenantContext $context): JsonResponse
    {
        Gate::authorize('tenant.manage');
        $tenant = $this->tenant($context);
        $branding->update($tenant, $request->validated());

        return response()->json(['data' => $branding->adminPayload($tenant)]);
    }

    public function setImage(BrandingImageRequest $request, string $kind, TenantBrandingService $branding, TenantContext $context): JsonResponse
    {
        Gate::authorize('tenant.manage');
        $tenant = $this->tenant($context);
        $branding->setImage($tenant, $this->kind($kind), $request->file('file'));

        return response()->json(['data' => $branding->adminPayload($tenant)]);
    }

    public function removeImage(string $kind, TenantBrandingService $branding, TenantContext $context): JsonResponse
    {
        Gate::authorize('tenant.manage');
        $tenant = $this->tenant($context);
        $branding->removeImage($tenant, $this->kind($kind));

        return response()->json(['data' => $branding->adminPayload($tenant)]);
    }

    private function kind(string $kind): string
    {
        return array_key_exists($kind, BrandingImages::KINDS) ? $kind : throw ApiProblem::notFound('Not found.');
    }

    private function tenant(TenantContext $context): Tenant
    {
        return Tenant::findOrFail($context->tenantId());
    }
}

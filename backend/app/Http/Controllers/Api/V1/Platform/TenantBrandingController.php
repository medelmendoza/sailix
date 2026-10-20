<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Http\Controllers\Controller;
use App\Http\Requests\Tenant\BrandingImageRequest;
use App\Http\Requests\Tenant\BrandingRequest;
use App\Models\Tenant;
use App\Support\ApiProblem;
use App\Tenancy\BrandingImages;
use App\Tenancy\TenantBrandingService;
use Illuminate\Http\JsonResponse;

/** The superadmin sets, or resets, how any organization looks. */
class TenantBrandingController extends Controller
{
    public function __construct(private TenantBrandingService $branding) {}

    public function show(Tenant $tenant): JsonResponse
    {
        return response()->json(['data' => $this->branding->adminPayload($tenant)]);
    }

    public function update(BrandingRequest $request, Tenant $tenant): JsonResponse
    {
        $this->branding->update($tenant, $request->validated());

        return response()->json(['data' => $this->branding->adminPayload($tenant)]);
    }

    public function setImage(BrandingImageRequest $request, Tenant $tenant, string $kind): JsonResponse
    {
        $this->branding->setImage($tenant, $this->kind($kind), $request->file('file'));

        return response()->json(['data' => $this->branding->adminPayload($tenant)]);
    }

    public function removeImage(Tenant $tenant, string $kind): JsonResponse
    {
        $this->branding->removeImage($tenant, $this->kind($kind));

        return response()->json(['data' => $this->branding->adminPayload($tenant)]);
    }

    public function reset(Tenant $tenant): JsonResponse
    {
        $this->branding->reset($tenant);

        return response()->json(['data' => $this->branding->adminPayload($tenant)]);
    }

    private function kind(string $kind): string
    {
        return array_key_exists($kind, BrandingImages::KINDS) ? $kind : throw ApiProblem::notFound('Not found.');
    }
}

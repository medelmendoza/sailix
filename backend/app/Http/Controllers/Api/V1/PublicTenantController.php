<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\TenantStatus;
use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Models\TenantBranding;
use App\Support\ApiProblem;
use App\Tenancy\AddressedTenant;
use App\Tenancy\BrandingImages;
use App\Tenancy\TenantBrandingService;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** What anybody may see about an organization before signing in: its name and look. Nothing about its people or data. */
class PublicTenantController extends Controller
{
    /** The organization the request's address names. 404 when it names none (the shared sign-in page). */
    public function show(AddressedTenant $addressed, TenantBrandingService $branding): JsonResponse
    {
        $tenant = $addressed->get() ?? throw new ApiProblem(404, 'tenant_not_found', 'No organization is configured for this address.');

        return response()->json(['data' => $branding->publicPayload($tenant)])->header('Cache-Control', 'no-cache');
    }

    public function logo(string $slug): StreamedResponse
    {
        $b = $this->branding($slug);

        return BrandingImages::stream($b->logo_path, $b->logo_mime);
    }

    public function favicon(string $slug): StreamedResponse
    {
        $b = $this->branding($slug);

        return BrandingImages::stream($b->favicon_path, $b->favicon_mime);
    }

    /** Images are public by design, but only for an organization that is open. */
    private function branding(string $slug): TenantBranding
    {
        $tenant = Tenant::where('slug', strtolower($slug))->whereIn('status', [TenantStatus::Active, TenantStatus::Provisioning])->first();

        return ($tenant ? TenantBranding::find($tenant->getKey()) : null) ?? throw ApiProblem::notFound('Image not found.');
    }
}

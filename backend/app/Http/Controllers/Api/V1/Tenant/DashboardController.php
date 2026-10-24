<?php

namespace App\Http\Controllers\Api\V1\Tenant;

use App\Enums\Feature;
use App\Enums\MembershipStatus;
use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\Membership;
use App\Models\Tenant;
use App\Support\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;

/**
 * Everything the admin dashboard shows, in one answer: the figures and the first page of each panel. Each part is what the
 * ordinary list returns (the same code, the same authorization), and a part the person may not see, or whose feature the
 * platform switched off, is simply left out instead of failing the whole page.
 */
class DashboardController extends Controller
{
    private const PANEL = 5; // keep equal to DASHBOARD_PANEL_SIZE in web/src/features/tenant/api.ts (the panels' cache keys)

    public function show(Request $request, TenantContext $context): JsonResponse
    {
        Gate::authorize('tenant.view'); // the admin portal's own ability; the parts below add their own

        $tenant = Tenant::findOrFail($context->tenantId());
        $on = fn (Feature $f) => $tenant->featureEnabled($f);
        $page = fn (AnonymousResourceCollection $c, Request $r) => $c->toResponse($r)->getData(true);
        $sub = fn (array $query) => $request->duplicate($query + ['page' => 1, 'per_page' => self::PANEL]);
        $out = [];

        if ($on(Feature::Crew) && Gate::allows('viewAny', Membership::class)) {
            $pending = $sub(['filter' => ['status' => 'pending']]);
            $out['crew'] = [
                'total' => Membership::where('role', Role::Crew)->where('status', '!=', MembershipStatus::Invited)->count(),
                'pending' => $page(app(CrewController::class)->index($pending), $pending),
            ];
        }
        if ($on(Feature::Documents) && Gate::allows('documents.manage')) {
            $pending = $sub(['status' => 'pending']);
            $out['documents'] = ['pending' => $page(app(DocumentController::class)->index($pending), $pending)];
        }
        if ($on(Feature::Announcements) && Gate::allows('announcements.manage')) {
            $latest = $sub([]);
            $out['announcements'] = ['latest' => $page(app(AnnouncementController::class)->index($latest), $latest)];
        }
        if (Gate::allows('users.manage')) {
            $open = $sub([]);
            $out['deletion_requests'] = ['open' => $page(app(DeletionRequestController::class)->index($open), $open)['meta']['total']];
        }

        return response()->json(['data' => $out]);
    }
}

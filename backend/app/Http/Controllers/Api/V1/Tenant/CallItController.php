<?php

namespace App\Http\Controllers\Api\V1\Tenant;

use App\Http\Controllers\Controller;
use App\Http\Resources\CallItReportResource;
use App\Models\CallItReport;
use App\Support\ApiProblem;
use App\Support\Audit;
use App\Support\DocumentFiles;
use App\Support\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Administrators read the reports their members SENT (drafts are private to the reporter) and mark them reviewed. */
class CallItController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('callit.manage');

        $query = CallItReport::with('membership.user')->whereIn('status', [CallItReport::SUBMITTED, CallItReport::REVIEWED]);
        if (in_array($request->input('status'), [CallItReport::SUBMITTED, CallItReport::REVIEWED], true)) {
            $query->where('status', $request->input('status'));
        }

        return CallItReportResource::collection(
            $query->orderByRaw("status = 'reviewed'")->orderByDesc('submitted_at')->orderBy('id')->paginate(min((int) $request->input('per_page', 20), 100)),
        );
    }

    public function file(string $report): StreamedResponse
    {
        Gate::authorize('callit.manage');

        return DocumentFiles::stream($this->find($report));
    }

    public function review(string $report, TenantContext $context): JsonResponse
    {
        Gate::authorize('callit.manage');
        $found = $this->find($report);
        if ($found->status !== CallItReport::SUBMITTED) {
            throw ApiProblem::conflict('not_submitted', 'Only a report that was sent and not yet reviewed can be marked reviewed.');
        }
        $found->forceFill(['status' => CallItReport::REVIEWED, 'reviewed_at' => now(), 'reviewed_by_membership_id' => $context->membershipId()])->save();
        Audit::record('callit.reviewed', $context->tenantId(), $found);

        return (new CallItReportResource($found->load('membership.user')))->response();
    }

    private function find(string $id): CallItReport
    {
        if (! preg_match('/^[0-9a-f-]{36}$/i', $id)) {
            throw ApiProblem::notFound('Report not found.');
        }

        // drafts are not the administrators' to see
        return CallItReport::with('membership.user')->whereIn('status', [CallItReport::SUBMITTED, CallItReport::REVIEWED])->whereKey($id)->first()
            ?? throw ApiProblem::notFound('Report not found.');
    }
}

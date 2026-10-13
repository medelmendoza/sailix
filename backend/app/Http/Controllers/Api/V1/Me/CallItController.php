<?php

namespace App\Http\Controllers\Api\V1\Me;

use App\Http\Controllers\Controller;
use App\Http\Requests\Me\CallItReportRequest;
use App\Http\Resources\CallItReportResource;
use App\Models\CallItReport;
use App\Support\ApiProblem;
use App\Support\Audit;
use App\Support\DocumentFiles;
use App\Support\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * A member's own Call-it reports. "Own" is always the session's membership. Only a DRAFT can be edited or deleted by the
 * reporter; once submitted it belongs to the organization's administrators to review.
 */
class CallItController extends Controller
{
    /** Milestones shown as "medals": reports submitted. */
    private const MILESTONES = [1, 10, 50, 100];

    public function stats(TenantContext $context): JsonResponse
    {
        $made = CallItReport::where('membership_id', $context->membershipId())->whereIn('status', [CallItReport::SUBMITTED, CallItReport::REVIEWED])->count();

        return response()->json(['data' => [
            'reports_made' => $made,
            'badges' => collect(self::MILESTONES)->filter(fn (int $m) => $made >= $m)->map(fn (int $m) => ['reports' => $m, 'label' => $m === 1 ? 'First report' : "$m reports made"])->values()->all(),
            'next_badge' => collect(self::MILESTONES)->first(fn (int $m) => $made < $m),
        ]]);
    }

    public function index(Request $request, TenantContext $context): JsonResponse
    {
        $query = CallItReport::where('membership_id', $context->membershipId());
        if (in_array($request->input('status'), [CallItReport::DRAFT, CallItReport::SUBMITTED, CallItReport::REVIEWED], true)) {
            $query->where('status', $request->input('status'));
        }

        return CallItReportResource::collection(
            $query->orderByDesc('updated_at')->orderBy('id')->paginate(min((int) $request->input('per_page', 20), 100)),
        )->response();
    }

    public function show(string $report, TenantContext $context): JsonResponse
    {
        return (new CallItReportResource($this->own($report, $context)))->response();
    }

    public function store(CallItReportRequest $request, TenantContext $context): JsonResponse
    {
        $report = (new CallItReport)->forceFill(['membership_id' => $context->membershipId(), 'status' => CallItReport::DRAFT] + $this->fields($request));
        $this->settle($report, $request, $context, 'callit.created');

        return (new CallItReportResource($report))->response()->setStatusCode(201);
    }

    public function update(CallItReportRequest $request, string $report, TenantContext $context): JsonResponse
    {
        $found = $this->draft($report, $context);
        $found->forceFill($this->fields($request));
        $this->settle($found, $request, $context, 'callit.updated');

        return (new CallItReportResource($found))->response();
    }

    public function destroy(string $report, TenantContext $context): JsonResponse
    {
        $found = $this->draft($report, $context);
        DocumentFiles::delete($found);
        $found->delete();

        return response()->json(null, 204);
    }

    public function attach(Request $request, string $report, TenantContext $context): JsonResponse
    {
        $found = $this->draft($report, $context);
        $request->validate(['file' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:'.DocumentFiles::maxKilobytes()]]);

        $old = clone $found;
        $found->forceFill(DocumentFiles::store($request->file('file'), $context->tenantId(), 'callit'))->save();
        DocumentFiles::delete($old);

        return (new CallItReportResource($found))->response();
    }

    public function detach(string $report, TenantContext $context): JsonResponse
    {
        $found = $this->draft($report, $context);
        $old = clone $found;
        $found->forceFill(['file_disk' => null, 'file_path' => null, 'file_original_name' => null, 'file_mime' => null, 'file_size' => null])->save();
        DocumentFiles::delete($old);

        return (new CallItReportResource($found))->response();
    }

    public function file(string $report, TenantContext $context): StreamedResponse
    {
        return DocumentFiles::stream($this->own($report, $context));
    }

    /** Saves the report; when `submit` is true it is now complete (validated) and goes to the administrators. */
    private function settle(CallItReport $report, CallItReportRequest $request, TenantContext $context, string $action): void
    {
        if ($request->boolean('submit')) {
            $this->assertComplete($report);
            $report->forceFill(['status' => CallItReport::SUBMITTED, 'submitted_at' => now()]);
            $action = 'callit.submitted';
        }
        $report->save(); // tenant_id is stamped from the context
        Audit::record($action, $context->tenantId(), $report); // never the text
    }

    /** A report that is sent must say what, where and how: checked on the draft as it will be saved. */
    private function assertComplete(CallItReport $report): void
    {
        $data = [
            'classification' => $report->classification, 'sub_classification' => $report->sub_classification,
            'location' => $report->location, 'location_other' => $report->location_other, 'vessel' => $report->vessel,
            'details' => $report->details, 'intervened' => $report->intervened, 'intervention_details' => $report->intervention_details,
        ];
        Validator::make($data, [
            'classification' => ['required'],
            'sub_classification' => ['required'],
            'location' => ['required'],
            'location_other' => [$report->location === 'others' ? 'required' : 'nullable'],
            'vessel' => ['required'],
            'details' => ['required', 'min:3'],
            'intervention_details' => [$report->intervened ? 'required' : 'nullable'],
        ])->validate();
    }

    /** @return array<string, mixed> */
    private function fields(CallItReportRequest $request): array
    {
        $out = [];
        foreach (['classification', 'sub_classification', 'location', 'location_other', 'vessel', 'details', 'intervention_details'] as $key) {
            if ($request->has($key)) {
                $v = $request->validated($key);
                $out[$key] = is_string($v) && trim($v) !== '' ? trim($v) : null;
            }
        }
        foreach (['intervened', 'official_report'] as $key) {
            if ($request->has($key)) {
                $out[$key] = $request->boolean($key);
            }
        }
        // "Other" text and intervention text only make sense with their switch
        if (($out['location'] ?? null) !== null && $out['location'] !== 'others') {
            $out['location_other'] = null;
        }
        if (array_key_exists('intervened', $out) && ! $out['intervened']) {
            $out['intervention_details'] = null;
        }

        return $out;
    }

    private function own(string $id, TenantContext $context): CallItReport
    {
        if (! preg_match('/^[0-9a-f-]{36}$/i', $id)) {
            throw ApiProblem::notFound('Report not found.');
        }

        // Someone else's report, another organization's, and a missing one all look the same.
        return CallItReport::where('membership_id', $context->membershipId())->whereKey($id)->first()
            ?? throw ApiProblem::notFound('Report not found.');
    }

    private function draft(string $id, TenantContext $context): CallItReport
    {
        $found = $this->own($id, $context);
        if ($found->status !== CallItReport::DRAFT) {
            throw ApiProblem::conflict('report_not_draft', 'A report that was sent cannot be changed.');
        }

        return $found;
    }
}

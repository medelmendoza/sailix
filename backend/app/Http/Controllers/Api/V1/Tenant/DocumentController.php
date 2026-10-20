<?php

namespace App\Http\Controllers\Api\V1\Tenant;

use App\Http\Controllers\Controller;
use App\Http\Resources\DocumentResource;
use App\Models\CrewDocument;
use App\Support\ApiProblem;
use App\Support\Audit;
use App\Support\DocumentFiles;
use App\Support\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** The agency's review of the documents its members submitted (own organization only). */
class DocumentController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('documents.manage');

        $query = CrewDocument::with(['type', 'membership.user', 'membership.profile']);
        if (in_array($request->input('status'), [CrewDocument::PENDING, CrewDocument::APPROVED, CrewDocument::REJECTED], true)) {
            $query->where('status', $request->input('status'));
        }
        $member = $request->input('membership_id');
        if (is_string($member) && preg_match('/^[0-9a-f-]{36}$/i', $member)) {
            $query->where('membership_id', $member);
        }

        return DocumentResource::collection(
            $query->orderBy('submitted_at')->orderBy('id')->paginate(min((int) $request->input('per_page', 20), 100)),
        );
    }

    public function file(string $document): StreamedResponse
    {
        Gate::authorize('documents.manage');

        return DocumentFiles::stream($this->find($document));
    }

    public function approve(string $document, TenantContext $context): JsonResponse
    {
        Gate::authorize('documents.manage');
        $found = $this->find($document);
        if ($found->status !== CrewDocument::PENDING) {
            throw ApiProblem::conflict('not_pending', 'Only a document that is waiting for review can be approved.');
        }
        $found->forceFill([
            'status' => CrewDocument::APPROVED, 'rejection_reason' => null,
            'reviewed_by_membership_id' => $context->membershipId(), 'reviewed_at' => now(),
        ])->save();
        Audit::record('document.approved', $context->tenantId(), $found);

        return (new DocumentResource($found->load(['type', 'membership.user'])))->response();
    }

    public function reject(Request $request, string $document, TenantContext $context): JsonResponse
    {
        Gate::authorize('documents.manage');
        $data = $request->validate(['reason' => ['required', 'string', 'min:1', 'max:500']]);
        $found = $this->find($document);
        if ($found->status !== CrewDocument::PENDING) {
            throw ApiProblem::conflict('not_pending', 'Only a document that is waiting for review can be rejected.');
        }
        $found->forceFill([
            'status' => CrewDocument::REJECTED, 'rejection_reason' => trim($data['reason']),
            'reviewed_by_membership_id' => $context->membershipId(), 'reviewed_at' => now(),
        ])->save();
        Audit::record('document.rejected', $context->tenantId(), $found); // the reason text is not audited

        return (new DocumentResource($found->load(['type', 'membership.user'])))->response();
    }

    private function find(string $id): CrewDocument
    {
        if (! preg_match('/^[0-9a-f-]{36}$/i', $id)) {
            throw ApiProblem::notFound('Document not found.');
        }

        return CrewDocument::with(['type', 'membership.user'])->whereKey($id)->first() ?? throw ApiProblem::notFound('Document not found.');
    }
}

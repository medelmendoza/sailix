<?php

namespace App\Http\Controllers\Api\V1\Tenant;

use App\Enums\MembershipStatus;
use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\CrewDocument;
use App\Models\DocumentAssignment;
use App\Models\DocumentType;
use App\Models\Membership;
use App\Support\ApiProblem;
use App\Support\Audit;
use App\Support\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Gate;

/**
 * One crew member's paperwork as the agency sees it: every kind of document the organization tracks, what the member
 * has on file for it, and whether the agency has asked them to submit or renew it.
 */
class CrewDocumentController extends Controller
{
    public function index(Membership $membership): JsonResponse
    {
        Gate::authorize('documents.manage');
        $this->crew($membership);

        $documents = CrewDocument::where('membership_id', $membership->getKey())->get()->groupBy('document_type_id');
        $open = DocumentAssignment::where('membership_id', $membership->getKey())->whereNull('fulfilled_at')
            ->pluck('document_type_id')->flip();

        $rows = DocumentType::where('is_active', true)->orderBy('name')->orderBy('id')->get()->map(function (DocumentType $type) use ($documents, $open) {
            $current = $this->current($documents->get($type->getKey()));

            return [
                'type' => ['id' => $type->id, 'name' => $type->name, 'short_name' => $type->short_name],
                'document' => $current ? [
                    'id' => $current->id, 'number' => $current->number, 'expires_on' => $current->expires_on?->format('Y-m-d'),
                    'review_status' => $current->status,
                ] : null,
                'state' => $this->state($current),
                'requested' => $open->has($type->getKey()),
            ];
        })->values();

        return response()->json(['data' => $rows]);
    }

    /** Ask the member for this kind of document. Asking again for one already asked is harmless. */
    public function request(Membership $membership, string $documentType, TenantContext $context): JsonResponse
    {
        Gate::authorize('documents.manage');
        $this->crew($membership);
        if ($membership->status !== MembershipStatus::Active) {
            throw ApiProblem::conflict('not_active', 'Only an active member can be asked for a document.');
        }
        $type = $this->activeType($documentType);

        $row = DocumentAssignment::where('membership_id', $membership->getKey())->where('document_type_id', $type->getKey())->first();
        if ($row && $row->fulfilled_at === null) {
            return response()->json(['data' => ['requested' => true]]);
        }
        if ($row) {
            $row->forceFill(['fulfilled_at' => null, 'requested_by_membership_id' => $context->membershipId()])->save(); // asked again
        } else {
            (new DocumentAssignment)->forceFill([
                'membership_id' => $membership->getKey(), 'document_type_id' => $type->getKey(),
                'requested_by_membership_id' => $context->membershipId(),
            ])->save(); // tenant_id is stamped from the context
        }
        Audit::record('document_request.created', $context->tenantId(), $membership, ['document_type_id' => $type->getKey()]);

        return response()->json(['data' => ['requested' => true]], 201);
    }

    public function withdraw(Membership $membership, string $documentType, TenantContext $context): JsonResponse
    {
        Gate::authorize('documents.manage');
        $this->crew($membership);
        $type = $this->activeType($documentType);

        $removed = DocumentAssignment::where('membership_id', $membership->getKey())->where('document_type_id', $type->getKey())
            ->whereNull('fulfilled_at')->delete();
        if ($removed > 0) {
            Audit::record('document_request.removed', $context->tenantId(), $membership, ['document_type_id' => $type->getKey()]);
        }

        return response()->json(null, 204);
    }

    private function crew(Membership $membership): void
    {
        if ($membership->role !== Role::Crew) {
            throw ApiProblem::notFound('Crew member not found.');
        }
    }

    private function activeType(string $id): DocumentType
    {
        if (! preg_match('/^[0-9a-f-]{36}$/i', $id)) {
            throw ApiProblem::notFound('Document type not found.');
        }

        return DocumentType::where('is_active', true)->whereKey($id)->first() ?? throw ApiProblem::notFound('Document type not found.');
    }

    /**
     * The document that counts for a kind: the approved one that stays valid longest (no expiry date outlasts any date),
     * otherwise the most recent submission, which is waiting for review or was sent back.
     *
     * @param  Collection<int, CrewDocument>|null  $documents
     */
    private function current($documents): ?CrewDocument
    {
        if ($documents === null || $documents->isEmpty()) {
            return null;
        }
        $approved = $documents->where('status', CrewDocument::APPROVED);
        if ($approved->isNotEmpty()) {
            return $approved->sortByDesc(fn (CrewDocument $d) => $d->expires_on?->timestamp ?? PHP_INT_MAX)->first();
        }

        return $documents->sortByDesc('submitted_at')->first();
    }

    /** missing | pending | rejected | none | valid | expiring | expired */
    private function state(?CrewDocument $document): string
    {
        return match (true) {
            $document === null => 'missing',
            $document->status === CrewDocument::PENDING => 'pending',
            $document->status === CrewDocument::REJECTED => 'rejected',
            default => $document->expiryStatus(),
        };
    }
}

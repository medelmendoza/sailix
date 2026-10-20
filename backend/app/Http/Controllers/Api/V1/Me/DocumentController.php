<?php

namespace App\Http\Controllers\Api\V1\Me;

use App\Http\Controllers\Controller;
use App\Http\Requests\Me\DocumentRequest;
use App\Http\Resources\DocumentResource;
use App\Models\CrewDocument;
use App\Models\DocumentAssignment;
use App\Models\DocumentType;
use App\Support\ApiProblem;
use App\Support\Audit;
use App\Support\DocumentFiles;
use App\Support\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * A member's own documents. "Own" always means the session's membership; an id in the request never widens it.
 * Approving or rejecting is the agency's job (Tenant\DocumentController): a member can only submit and resubmit.
 */
class DocumentController extends Controller
{
    public function types(): JsonResponse
    {
        return response()->json(['data' => DocumentType::where('is_active', true)->orderBy('name')->get(['id', 'name', 'short_name'])]);
    }

    /** The kinds of document the agency asked this member to submit or renew and they have not answered yet. */
    public function requests(TenantContext $context): JsonResponse
    {
        $rows = DocumentAssignment::with('type')->where('membership_id', $context->membershipId())->whereNull('fulfilled_at')
            ->whereHas('type', fn ($q) => $q->where('is_active', true))->orderBy('created_at')->orderBy('id')->get()
            ->map(fn (DocumentAssignment $r) => [
                'type' => ['id' => $r->type->id, 'name' => $r->type->name, 'short_name' => $r->type->short_name],
                'requested_at' => $r->updated_at?->toIso8601String(),
            ])->values();

        return response()->json(['data' => $rows]);
    }

    public function index(Request $request, TenantContext $context): JsonResponse
    {
        $member = $context->membershipId();
        $status = in_array($request->input('status'), [CrewDocument::PENDING, CrewDocument::APPROVED, CrewDocument::REJECTED, 'review'], true)
            ? $request->input('status') : CrewDocument::APPROVED;

        $query = CrewDocument::with('type')->where('membership_id', $member);
        // `review` = everything not approved yet (waiting or sent back), as the old "Pending" list showed
        $status === 'review'
            ? $query->whereIn('status', [CrewDocument::PENDING, CrewDocument::REJECTED])
            : $query->where('status', $status);

        $docs = $query->orderByRaw('expires_on is null')->orderBy('expires_on')->orderBy('id')->get();

        $approved = CrewDocument::where('membership_id', $member)->where('status', CrewDocument::APPROVED)->get();
        $counts = ['expired' => 0, 'expiring' => 0];
        foreach ($approved as $d) {
            $e = $d->expiryStatus();
            if (isset($counts[$e])) {
                $counts[$e]++;
            }
        }

        return DocumentResource::collection($docs)->additional(['counts' => $counts])->response();
    }

    public function show(string $document, TenantContext $context): JsonResponse
    {
        return (new DocumentResource($this->own($document, $context)->load('type')))->response();
    }

    public function file(string $document, TenantContext $context): StreamedResponse
    {
        return DocumentFiles::stream($this->own($document, $context));
    }

    public function store(DocumentRequest $request, TenantContext $context): JsonResponse
    {
        $type = $this->activeType((string) $request->validated('document_type_id'));
        $file = DocumentFiles::store($request->file('file'), $context->tenantId());

        $document = (new CrewDocument)->forceFill([
            'membership_id' => $context->membershipId(),
            'document_type_id' => $type->id,
            'status' => CrewDocument::PENDING,
            'submitted_at' => now(),
        ] + $this->fields($request) + $file);
        $document->save(); // tenant_id is stamped from the context
        DocumentAssignment::fulfil((string) $context->membershipId(), $type->id); // answers an agency request for this kind
        Audit::record('document.submitted', $context->tenantId(), $document);

        return (new DocumentResource($document->load('type')))->response()->setStatusCode(201);
    }

    /**
     * Fix and send again a document that is still waiting or was sent back. An APPROVED document is final for the
     * member (docs/16: the old app let people edit approved records, which made approval meaningless).
     */
    public function resubmit(DocumentRequest $request, string $document, TenantContext $context): JsonResponse
    {
        $found = $this->own($document, $context);
        if ($found->status === CrewDocument::APPROVED) {
            throw ApiProblem::conflict('document_approved', 'An approved document cannot be changed. Submit a new one.');
        }

        $values = $this->fields($request);
        if ($request->filled('document_type_id')) {
            $values['document_type_id'] = $this->activeType((string) $request->validated('document_type_id'))->id;
        }
        $oldFile = null;
        if ($request->hasFile('file')) {
            $oldFile = clone $found;
            $values += DocumentFiles::store($request->file('file'), $context->tenantId());
        }
        $found->forceFill($values + [
            'status' => CrewDocument::PENDING, 'rejection_reason' => null,
            'reviewed_by_membership_id' => null, 'reviewed_at' => null, 'submitted_at' => now(),
        ])->save();
        if ($oldFile) {
            DocumentFiles::delete($oldFile);
        }
        DocumentAssignment::fulfil((string) $context->membershipId(), $found->document_type_id);
        Audit::record('document.resubmitted', $context->tenantId(), $found);

        return (new DocumentResource($found->load('type')))->response();
    }

    /** @return array<string, mixed> */
    private function fields(DocumentRequest $request): array
    {
        $out = [];
        foreach (['number', 'grade', 'location', 'school', 'issued_on', 'expires_on'] as $key) {
            if ($request->has($key)) {
                $v = $request->validated($key);
                $out[$key] = is_string($v) ? (trim($v) === '' ? null : trim($v)) : $v;
            }
        }

        return $out;
    }

    private function activeType(string $id): DocumentType
    {
        return DocumentType::where('is_active', true)->whereKey($id)->first()
            ?? throw ApiProblem::invalid('invalid_document_type', 'Choose a document type from the list.');
    }

    private function own(string $id, TenantContext $context): CrewDocument
    {
        if (! preg_match('/^[0-9a-f-]{36}$/i', $id)) {
            throw ApiProblem::notFound('Document not found.');
        }

        // Someone else's document, another organization's, and a missing one all look the same.
        return CrewDocument::where('membership_id', $context->membershipId())->whereKey($id)->first()
            ?? throw ApiProblem::notFound('Document not found.');
    }
}

<?php

namespace App\Http\Controllers\Api\V1\Tenant;

use App\Http\Controllers\Controller;
use App\Http\Requests\Tenant\DocumentTypeRequest;
use App\Models\CrewDocument;
use App\Models\DocumentType;
use App\Support\ApiProblem;
use App\Support\Audit;
use App\Support\Tenancy\TenantContext;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/** The organization's own list of document types (passport, seaman's book, medical...). */
class DocumentTypeController extends Controller
{
    public function index(): JsonResponse
    {
        Gate::authorize('documents.manage');

        return response()->json(['data' => DocumentType::orderBy('name')->get(['id', 'name', 'short_name', 'is_active'])]);
    }

    public function store(DocumentTypeRequest $request, TenantContext $context): JsonResponse
    {
        Gate::authorize('documents.manage');

        $type = (new DocumentType)->forceFill([
            'name' => trim($request->validated('name')),
            'short_name' => $this->short($request->validated('short_name')),
            'is_active' => $request->validated('is_active', true),
        ]);
        $this->save($type);
        Audit::record('document_type.created', $context->tenantId(), $type);

        return response()->json(['data' => $this->shape($type)], 201);
    }

    public function update(DocumentTypeRequest $request, string $documentType, TenantContext $context): JsonResponse
    {
        Gate::authorize('documents.manage');
        $type = $this->find($documentType);

        $values = $request->validated();
        if (array_key_exists('name', $values)) {
            $values['name'] = trim($values['name']);
        }
        if (array_key_exists('short_name', $values)) {
            $values['short_name'] = $this->short($values['short_name']);
        }
        $type->forceFill($values);
        $this->save($type);
        Audit::record('document_type.updated', $context->tenantId(), $type, ['fields' => array_keys($values)]);

        return response()->json(['data' => $this->shape($type)]);
    }

    /** A type that documents refer to is switched off instead (its history stays readable). */
    public function destroy(string $documentType, TenantContext $context): JsonResponse
    {
        Gate::authorize('documents.manage');
        $type = $this->find($documentType);
        if (CrewDocument::where('document_type_id', $type->id)->exists()) {
            throw ApiProblem::conflict('document_type_in_use', 'Documents use this type. Switch it off instead of deleting it.');
        }
        $type->delete();
        Audit::record('document_type.deleted', $context->tenantId(), $type);

        return response()->json(null, 204);
    }

    private function save(DocumentType $type): void
    {
        try {
            $type->save();
        } catch (QueryException) {
            throw ApiProblem::conflict('document_type_exists', 'You already have a document type with that name.');
        }
    }

    private function short(mixed $value): ?string
    {
        return is_string($value) && trim($value) !== '' ? trim($value) : null;
    }

    /** @return array<string, mixed> */
    private function shape(DocumentType $t): array
    {
        return ['id' => $t->id, 'name' => $t->name, 'short_name' => $t->short_name, 'is_active' => $t->is_active];
    }

    private function find(string $id): DocumentType
    {
        if (! preg_match('/^[0-9a-f-]{36}$/i', $id)) {
            throw ApiProblem::notFound('Document type not found.');
        }

        return DocumentType::whereKey($id)->first() ?? throw ApiProblem::notFound('Document type not found.');
    }
}

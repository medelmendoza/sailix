<?php

namespace App\Http\Controllers\Api\V1\Tenant;

use App\Http\Controllers\Controller;
use App\Http\Requests\Tenant\AnnouncementRequest;
use App\Http\Resources\AnnouncementResource;
use App\Models\Announcement;
use App\Support\ApiProblem;
use App\Support\Audit;
use App\Support\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;

/** Administrators write and manage the organization's announcements. Never records the text in the audit trail. */
class AnnouncementController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('announcements.manage');

        return AnnouncementResource::collection(
            Announcement::orderByDesc('created_at')->orderBy('id')
                ->paginate(min((int) $request->input('per_page', 20), 100)),
        );
    }

    public function store(AnnouncementRequest $request, TenantContext $context): JsonResponse
    {
        Gate::authorize('announcements.manage');

        $announcement = (new Announcement)->forceFill([
            'created_by_membership_id' => $context->membershipId(),
            'title' => trim($request->validated('title')),
            'body' => trim($request->validated('body')),
            'is_active' => $request->validated('is_active', true),
            'expires_at' => $request->validated('expires_at'),
        ]);
        $announcement->save(); // tenant_id is stamped from the context
        Audit::record('announcement.created', $context->tenantId(), $announcement);

        return (new AnnouncementResource($announcement))->response()->setStatusCode(201);
    }

    public function update(AnnouncementRequest $request, string $announcement, TenantContext $context): JsonResponse
    {
        Gate::authorize('announcements.manage');
        $found = $this->find($announcement);

        $values = $request->validated();
        foreach (['title', 'body'] as $text) {
            if (array_key_exists($text, $values)) {
                $values[$text] = trim($values[$text]);
            }
        }
        $found->forceFill($values)->save();
        Audit::record('announcement.updated', $context->tenantId(), $found, ['fields' => array_keys($values)]);

        return (new AnnouncementResource($found))->response();
    }

    public function destroy(string $announcement, TenantContext $context): JsonResponse
    {
        Gate::authorize('announcements.manage');
        $found = $this->find($announcement);
        $found->delete();
        Audit::record('announcement.deleted', $context->tenantId(), $found);

        return response()->json(null, 204);
    }

    private function find(string $id): Announcement
    {
        if (! preg_match('/^[0-9a-f-]{36}$/i', $id)) {
            throw ApiProblem::notFound('Announcement not found.');
        }

        return Announcement::whereKey($id)->first() ?? throw ApiProblem::notFound('Announcement not found.');
    }
}

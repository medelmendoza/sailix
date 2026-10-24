<?php

namespace App\Http\Controllers\Api\V1\Tenant;

use App\Http\Controllers\Controller;
use App\Http\Requests\Tenant\AnnouncementAttachmentRequest;
use App\Http\Requests\Tenant\AnnouncementRequest;
use App\Http\Resources\AnnouncementResource;
use App\Models\Announcement;
use App\Models\AnnouncementFleet;
use App\Support\ApiProblem;
use App\Support\Audit;
use App\Support\DocumentFiles;
use App\Support\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Administrators write and manage the organization's announcements. Never records the text in the audit trail. */
class AnnouncementController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('announcements.manage');

        $title = is_string($request->input('filter.title')) && trim($request->input('filter.title')) !== ''
            ? '%'.addcslashes(trim($request->input('filter.title')), '%_\\').'%' : null;

        return AnnouncementResource::collection(
            Announcement::with(['creator.user', 'creator.profile', 'fleets'])
                ->when($title, fn ($q, $v) => $q->where('title', 'like', $v))
                ->orderByDesc('created_at')->orderBy('id')
                ->paginate(min((int) $request->input('per_page', 20), 100)),
        );
    }

    public function store(AnnouncementRequest $request, TenantContext $context): JsonResponse
    {
        Gate::authorize('announcements.manage');

        $announcement = DB::transaction(function () use ($request, $context) {
            $new = (new Announcement)->forceFill([
                'created_by_membership_id' => $context->membershipId(),
                'title' => trim($request->validated('title')),
                'body' => trim($request->validated('body')),
                'is_active' => $request->validated('is_active', true),
                'expires_at' => $request->validated('expires_at'),
            ]);
            $new->save(); // tenant_id is stamped from the context
            $this->syncFleets($new, $request->validated('fleets') ?? []);

            return $new;
        });
        Audit::record('announcement.created', $context->tenantId(), $announcement);

        return (new AnnouncementResource($announcement->load(['creator.user', 'creator.profile', 'fleets'])))->response()->setStatusCode(201);
    }

    public function update(AnnouncementRequest $request, string $announcement, TenantContext $context): JsonResponse
    {
        Gate::authorize('announcements.manage');
        $found = $this->find($announcement);

        $values = $request->validated();
        $fleets = array_key_exists('fleets', $values) ? ($values['fleets'] ?? []) : null;
        unset($values['fleets']);
        foreach (['title', 'body'] as $text) {
            if (array_key_exists($text, $values)) {
                $values[$text] = trim($values[$text]);
            }
        }
        DB::transaction(function () use ($found, $values, $fleets) {
            $found->forceFill($values)->save();
            if ($fleets !== null) {
                $this->syncFleets($found, $fleets);
            }
        });
        Audit::record('announcement.updated', $context->tenantId(), $found, ['fields' => array_keys($values + ($fleets !== null ? ['fleets' => 1] : []))]);

        return (new AnnouncementResource($found->load(['creator.user', 'creator.profile', 'fleets'])))->response();
    }

    /** Attach (or replace) the file. PDF, JPEG or PNG, decided from the content; the size limit is the organization's. */
    public function attach(AnnouncementAttachmentRequest $request, string $announcement, TenantContext $context): JsonResponse
    {
        Gate::authorize('announcements.manage');
        $found = $this->find($announcement);

        $old = clone $found;
        $found->forceFill(DocumentFiles::store($request->file('file'), $context->tenantId(), 'announcements'))->save();
        if ($old->file_path !== null) {
            DocumentFiles::delete($old);
        }
        Audit::record('announcement.attachment_set', $context->tenantId(), $found);

        return (new AnnouncementResource($found->load(['creator.user', 'creator.profile', 'fleets'])))->response();
    }

    public function detach(string $announcement, TenantContext $context): JsonResponse
    {
        Gate::authorize('announcements.manage');
        $found = $this->find($announcement);

        if ($found->file_path !== null) {
            DocumentFiles::delete($found);
            $found->forceFill(['file_disk' => null, 'file_path' => null, 'file_original_name' => null, 'file_mime' => null, 'file_size' => null])->save();
            Audit::record('announcement.attachment_removed', $context->tenantId(), $found);
        }

        return response()->json(null, 204);
    }

    public function file(string $announcement): StreamedResponse
    {
        Gate::authorize('announcements.manage');

        return DocumentFiles::stream($this->find($announcement));
    }

    public function destroy(string $announcement, TenantContext $context): JsonResponse
    {
        Gate::authorize('announcements.manage');
        $found = $this->find($announcement);
        DocumentFiles::delete($found);
        $found->delete();
        Audit::record('announcement.deleted', $context->tenantId(), $found);

        return response()->json(null, 204);
    }

    /** @param  list<string>  $fleets  empty = everyone */
    private function syncFleets(Announcement $announcement, array $fleets): void
    {
        $wanted = collect($fleets)->map(fn ($f) => trim((string) $f))->filter()->unique(fn ($f) => mb_strtolower($f))->values();
        $announcement->fleets()->delete();
        foreach ($wanted as $fleet) {
            (new AnnouncementFleet)->forceFill(['announcement_id' => $announcement->getKey(), 'fleet' => $fleet])->save();
        }
    }

    private function find(string $id): Announcement
    {
        if (! preg_match('/^[0-9a-f-]{36}$/i', $id)) {
            throw ApiProblem::notFound('Announcement not found.');
        }

        return Announcement::whereKey($id)->first() ?? throw ApiProblem::notFound('Announcement not found.');
    }
}

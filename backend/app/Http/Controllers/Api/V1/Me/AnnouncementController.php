<?php

namespace App\Http\Controllers\Api\V1\Me;

use App\Http\Controllers\Controller;
use App\Http\Resources\AnnouncementResource;
use App\Models\Announcement;
use App\Models\AnnouncementRead;
use App\Support\ApiProblem;
use App\Support\DocumentFiles;
use App\Support\Tenancy\TenantContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** A member's view of their own organization's announcements (the organization comes from the session). */
class AnnouncementController extends Controller
{
    public function index(Request $request, TenantContext $context): JsonResponse
    {
        $member = $context->membershipId();
        $title = is_string($request->input('filter.title')) && trim($request->input('filter.title')) !== ''
            ? '%'.addcslashes(trim($request->input('filter.title')), '%_\\').'%' : null;
        $page = $this->visible($member)
            ->when($title, fn ($q, $v) => $q->where('title', 'like', $v))
            ->orderByDesc('created_at')->orderBy('id')
            ->paginate(min((int) $request->input('per_page', 20), 100));

        $unread = Announcement::visibleTo($member)
            ->whereDoesntHave('reads', fn ($q) => $q->where('membership_id', $member))
            ->count();

        return AnnouncementResource::collection($page)->additional(['unread_count' => $unread])->response();
    }

    public function show(string $announcement, TenantContext $context): JsonResponse
    {
        return (new AnnouncementResource($this->find($announcement, $context)))->response();
    }

    /** Idempotent: reading twice leaves one read record. */
    public function read(string $announcement, TenantContext $context): JsonResponse
    {
        $found = $this->find($announcement, $context);
        $member = $context->membershipId();

        if (! AnnouncementRead::where('announcement_id', $found->id)->where('membership_id', $member)->exists()) {
            try {
                (new AnnouncementRead)->forceFill([
                    'announcement_id' => $found->id, 'membership_id' => $member, 'read_at' => now(),
                ])->save(); // tenant_id is stamped from the context
            } catch (QueryException) {
                // lost a race with a concurrent identical request: already recorded
            }
        }

        return (new AnnouncementResource($this->find($announcement, $context)))->response();
    }

    public function file(string $announcement, TenantContext $context): StreamedResponse
    {
        return DocumentFiles::stream($this->find($announcement, $context));
    }

    /** @return Builder<Announcement> */
    private function visible(string $member)
    {
        return Announcement::visibleTo($member)
            ->withExists(['reads as is_read' => fn ($q) => $q->where('membership_id', $member)]);
    }

    private function find(string $id, TenantContext $context): Announcement
    {
        // Another organization's id, an inactive or expired one, and a malformed id all look the same.
        if (! preg_match('/^[0-9a-f-]{36}$/i', $id)) {
            throw ApiProblem::notFound('Announcement not found.');
        }

        return $this->visible($context->membershipId())->whereKey($id)->first()
            ?? throw ApiProblem::notFound('Announcement not found.');
    }
}

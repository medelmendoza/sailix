<?php

namespace App\Http\Controllers\Api\V1\Me;

use App\Http\Controllers\Controller;
use App\Http\Requests\Me\UpdateTodoRequest;
use App\Http\Resources\TodoResource;
use App\Models\Todo;
use App\Support\ApiProblem;
use App\Support\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** A member's own to-dos. "Own" is decided by the session's membership, never by an id in the request. */
class TodoController extends Controller
{
    public function index(Request $request, TenantContext $context): JsonResponse
    {
        $member = $context->membershipId();
        $query = Todo::where('membership_id', $member);

        $status = $request->input('status');
        if ($status === 'open') {
            $query->where('is_done', false);
        } elseif ($status === 'done') {
            $query->where('is_done', true);
        }

        // Open first, soonest due first (no date last), then the newest.
        $page = $query->orderBy('is_done')
            ->orderByRaw('due_date is null')->orderBy('due_date')
            ->orderByDesc('created_at')->orderBy('id')
            ->paginate(min((int) $request->input('per_page', 20), 100));

        $open = Todo::where('membership_id', $member)->where('is_done', false)->count();
        $overdue = Todo::where('membership_id', $member)->where('is_done', false)
            ->whereDate('due_date', '<', now()->toDateString())->count();

        return TodoResource::collection($page)->additional(['open_count' => $open, 'overdue_count' => $overdue])->response();
    }

    /** Idempotent: ticking an already ticked task keeps its original completion time. */
    public function update(UpdateTodoRequest $request, string $todo, TenantContext $context): JsonResponse
    {
        if (! preg_match('/^[0-9a-f-]{36}$/i', $todo)) {
            throw ApiProblem::notFound('To-do not found.');
        }
        $found = Todo::where('membership_id', $context->membershipId())->whereKey($todo)->first()
            ?? throw ApiProblem::notFound('To-do not found.'); // someone else's task looks the same as a missing one

        $done = $request->boolean('is_done');
        if ($found->is_done !== $done) {
            $found->forceFill(['is_done' => $done, 'done_at' => $done ? now() : null])->save();
        }

        return (new TodoResource($found))->response();
    }
}

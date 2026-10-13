<?php

namespace App\Http\Controllers\Api\V1\Tenant;

use App\Enums\MembershipStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Tenant\TodoRequest;
use App\Http\Resources\TodoResource;
use App\Models\Membership;
use App\Models\Todo;
use App\Support\ApiProblem;
use App\Support\Audit;
use App\Support\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

/** Administrators assign and manage the organization's to-dos. The text is never written to the audit trail. */
class TodoController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('todos.manage');

        $query = Todo::with('membership.user');
        if (in_array($request->input('status'), ['open', 'done'], true)) {
            $query->where('is_done', $request->input('status') === 'done');
        }
        if (is_string($request->input('membership_id')) && preg_match('/^[0-9a-f-]{36}$/i', $request->input('membership_id'))) {
            $query->where('membership_id', $request->input('membership_id'));
        }

        return TodoResource::collection(
            $query->orderBy('is_done')->orderByRaw('due_date is null')->orderBy('due_date')->orderByDesc('created_at')->orderBy('id')
                ->paginate(min((int) $request->input('per_page', 20), 100)),
        );
    }

    /** One to-do per chosen member, created together or not at all. */
    public function store(TodoRequest $request, TenantContext $context): JsonResponse
    {
        Gate::authorize('todos.manage');

        /** @var list<string> $ids */
        $ids = $request->validated('membership_ids');
        // Only active members of THIS organization (the model is tenant-scoped); anything else is refused as a whole.
        $valid = Membership::whereIn('id', $ids)->where('status', MembershipStatus::Active)->pluck('id')->all();
        if (count($valid) !== count($ids)) {
            throw ApiProblem::invalid('invalid_assignee', 'Choose active members of your organization.');
        }

        $created = DB::transaction(fn () => array_map(function (string $member) use ($request, $context) {
            $todo = (new Todo)->forceFill([
                'membership_id' => $member,
                'created_by_membership_id' => $context->membershipId(),
                'description' => trim($request->validated('description')),
                'due_date' => $request->validated('due_date'),
            ]);
            $todo->save(); // tenant_id is stamped from the context

            return $todo;
        }, $ids));
        Audit::record('todo.created', $context->tenantId(), null, ['count' => count($created)]);

        return TodoResource::collection(collect($created))->response()->setStatusCode(201);
    }

    public function update(TodoRequest $request, string $todo, TenantContext $context): JsonResponse
    {
        Gate::authorize('todos.manage');
        $found = $this->find($todo);

        $values = $request->validated();
        if (array_key_exists('description', $values)) {
            $values['description'] = trim($values['description']);
        }
        $found->forceFill($values)->save();
        Audit::record('todo.updated', $context->tenantId(), $found, ['fields' => array_keys($values)]);

        return (new TodoResource($found->load('membership.user')))->response();
    }

    public function destroy(string $todo, TenantContext $context): JsonResponse
    {
        Gate::authorize('todos.manage');
        $found = $this->find($todo);
        $found->delete();
        Audit::record('todo.deleted', $context->tenantId(), $found);

        return response()->json(null, 204);
    }

    private function find(string $id): Todo
    {
        if (! preg_match('/^[0-9a-f-]{36}$/i', $id)) {
            throw ApiProblem::notFound('To-do not found.');
        }

        return Todo::whereKey($id)->first() ?? throw ApiProblem::notFound('To-do not found.');
    }
}

<?php

namespace App\Http\Controllers\Api\V1\Tenant;

use App\Http\Controllers\Controller;
use App\Http\Resources\FeedbackResource;
use App\Models\Feedback;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;

class FeedbackController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('users.manage');

        return FeedbackResource::collection(
            Feedback::with('membership.user')
                ->orderByDesc('created_at')->orderBy('id')
                ->paginate(min((int) $request->input('per_page', 20), 100)),
        );
    }
}

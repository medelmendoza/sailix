<?php

namespace App\Http\Controllers\Api\V1\Tenant;

use App\Http\Controllers\Controller;
use App\Http\Resources\DeletionRequestResource;
use App\Models\DeletionRequest;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;

class DeletionRequestController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('users.manage');

        return DeletionRequestResource::collection(
            DeletionRequest::with(['membership.user', 'membership.profile'])
                ->where('status', 'pending')
                ->orderBy('requested_at')->orderBy('id')
                ->paginate(min((int) $request->input('per_page', 20), 100)),
        );
    }
}

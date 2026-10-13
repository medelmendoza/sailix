<?php

namespace App\Http\Controllers\Api\V1\Tenant;

use App\Http\Controllers\Controller;
use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;

class AuditLogController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('audit.view');

        return AuditLogResource::collection(
            AuditLog::query()
                ->when($request->input('filter.action'), fn ($b, $v) => $b->where('action', $v))
                ->orderByDesc('created_at')->orderByDesc('id')
                ->paginate(min((int) $request->input('per_page', 20), 100)),
        );
    }
}

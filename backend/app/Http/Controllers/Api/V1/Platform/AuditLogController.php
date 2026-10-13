<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Http\Controllers\Controller;
use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class AuditLogController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        return AuditLogResource::collection(
            AuditLog::query()
                ->when($request->input('filter.tenant_id'), fn ($b, $v) => $b->where('tenant_id', $v))
                ->when($request->input('filter.action'), fn ($b, $v) => $b->where('action', $v))
                ->orderByDesc('created_at')->orderByDesc('id')
                ->paginate(min((int) $request->input('per_page', 20), 100)),
        );
    }
}

<?php

namespace App\Http\Resources;

use App\Models\Tenant;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Tenant */
class TenantResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'slug' => $this->slug,
            'default_address' => $this->slug.'.'.config('sailix.tenancy.base_domain'),
            'name' => $this->name,
            'status' => $this->status->value,
            'activated_at' => $this->activated_at?->toIso8601String(),
            'archived_at' => $this->archived_at?->toIso8601String(),
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}

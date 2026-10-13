<?php

namespace App\Http\Resources;

use App\Models\Membership;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Membership */
class MembershipResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'role' => $this->role->value,
            'status' => $this->status->value,
            'user' => $this->whenLoaded('user', fn () => [
                'id' => $this->user->id,
                'username' => $this->user->username,
                'email' => $this->user->email,
                'display_name' => $this->user->display_name,
            ]),
            'profile' => $this->whenLoaded('profile', fn () => $this->profile ? (new ProfileResource($this->profile))->resolve() : null),
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}

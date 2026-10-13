<?php

namespace App\Http\Resources;

use App\Models\DeletionRequest;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin DeletionRequest */
class DeletionRequestResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status,
            'requested_at' => $this->requested_at->toIso8601String(),
            'membership' => $this->whenLoaded('membership', fn () => [
                'id' => $this->membership->id,
                'user' => [
                    'id' => $this->membership->user->id,
                    'username' => $this->membership->user->username,
                    'email' => $this->membership->user->email,
                ],
                'profile' => $this->membership->profile ? (new ProfileResource($this->membership->profile))->resolve() : null,
            ]),
        ];
    }
}

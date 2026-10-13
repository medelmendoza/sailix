<?php

namespace App\Http\Resources;

use App\Models\Todo;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Todo */
class TodoResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'description' => $this->description,
            'due_date' => $this->due_date?->format('Y-m-d'),
            'is_done' => $this->is_done,
            'done_at' => $this->done_at?->toIso8601String(),
            'created_at' => $this->created_at->toIso8601String(),
            'assignee' => $this->whenLoaded('membership', fn () => [
                'id' => $this->membership->id,
                'user' => [
                    'id' => $this->membership->user->id,
                    'username' => $this->membership->user->username,
                    'email' => $this->membership->user->email,
                ],
            ]),
        ];
    }
}

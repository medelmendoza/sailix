<?php

namespace App\Http\Resources;

use App\Models\Feedback;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Feedback */
class FeedbackResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'category' => $this->category,
            'message' => $this->message,
            'created_at' => $this->created_at->toIso8601String(),
            'membership' => $this->whenLoaded('membership', fn () => [
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

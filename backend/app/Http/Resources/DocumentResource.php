<?php

namespace App\Http\Resources;

use App\Models\CrewDocument;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin CrewDocument */
class DocumentResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $expiry = $this->expiryStatus();

        return [
            'id' => $this->id,
            'status' => $this->status,
            'type' => $this->whenLoaded('type', fn () => [
                'id' => $this->type->id, 'name' => $this->type->name, 'short_name' => $this->type->short_name,
            ]),
            'number' => $this->number,
            'grade' => $this->grade,
            'location' => $this->location,
            'school' => $this->school,
            'issued_on' => $this->issued_on?->format('Y-m-d'),
            'expires_on' => $this->expires_on?->format('Y-m-d'),
            // Computed on the server (never trusted from a client): none | valid | expiring | expired
            'expiry_status' => $expiry,
            'rejection_reason' => $this->status === CrewDocument::REJECTED ? $this->rejection_reason : null,
            'file' => ['name' => $this->file_original_name, 'type' => $this->file_mime, 'size' => $this->file_size],
            'submitted_at' => $this->submitted_at->toIso8601String(),
            'reviewed_at' => $this->reviewed_at?->toIso8601String(),
            'owner' => $this->whenLoaded('membership', fn () => [
                'id' => $this->membership->id,
                'user' => [
                    'id' => $this->membership->user->id,
                    'username' => $this->membership->user->username,
                    'email' => $this->membership->user->email,
                ],
                'profile' => $this->membership->relationLoaded('profile') && $this->membership->profile ? [
                    'first_name' => $this->membership->profile->first_name,
                    'last_name' => $this->membership->profile->last_name,
                    'crew_number' => $this->membership->profile->crew_number,
                    'rank' => $this->membership->profile->rank,
                ] : null,
            ]),
        ];
    }
}

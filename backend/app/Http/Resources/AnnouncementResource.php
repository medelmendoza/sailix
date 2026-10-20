<?php

namespace App\Http\Resources;

use App\Models\Announcement;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Announcement
 *
 * `is_read` is present only when the query asked for it (the member's own view); the admin view has no read state.
 */
class AnnouncementResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'body' => $this->body,
            'is_active' => $this->is_active,
            'expires_at' => $this->expires_at?->toIso8601String(),
            'created_at' => $this->created_at->toIso8601String(),
            'updated_at' => $this->updated_at->toIso8601String(),
            'attachment' => $this->file_path !== null
                ? ['name' => $this->file_original_name, 'type' => $this->file_mime, 'size' => $this->file_size] : null,
            // who it is for: an empty list means everyone (the administrators' list only)
            'fleets' => $this->whenLoaded('fleets', fn () => $this->fleets->pluck('fleet')->sort()->values()->all()),
            // who wrote it: only where the query loaded it (the administrators' list), never in the members' view
            'author' => $this->whenLoaded('creator', fn () => $this->creator ? [
                'name' => trim(($this->creator->profile?->first_name ?? '').' '.($this->creator->profile?->last_name ?? '')) ?: $this->creator->user->username,
            ] : null),
            ...(array_key_exists('is_read', $this->resource->getAttributes()) ? ['is_read' => (bool) $this->resource->getAttribute('is_read')] : []),
        ];
    }
}

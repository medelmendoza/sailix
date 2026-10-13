<?php

namespace App\Http\Resources;

use App\Models\CallItReport;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin CallItReport */
class CallItReportResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status,
            'classification' => $this->classification,
            'sub_classification' => $this->sub_classification,
            'location' => $this->location,
            'location_other' => $this->location_other,
            'vessel' => $this->vessel,
            'details' => $this->details,
            'intervened' => $this->intervened,
            'intervention_details' => $this->intervention_details,
            'official_report' => $this->official_report,
            'file' => $this->hasFile() ? ['name' => $this->file_original_name, 'type' => $this->file_mime, 'size' => $this->file_size] : null,
            'submitted_at' => $this->submitted_at?->toIso8601String(),
            'reviewed_at' => $this->reviewed_at?->toIso8601String(),
            'created_at' => $this->created_at->toIso8601String(),
            'reporter' => $this->whenLoaded('membership', fn () => [
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

<?php

namespace App\Http\Resources;

use App\Models\Membership;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A crew member as an administrator sees them: the account plus the crew record. The birthday is returned only
 * where it is needed to edit it (the single-member view), never in the list.
 *
 * @mixin Membership
 */
class CrewResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $p = $this->profile;
        $detail = ! $request->routeIs('crew.index');

        return [
            'id' => $this->id,
            'status' => $this->status->value,
            'username' => $this->user->username,
            'email' => $this->user->email,
            'first_name' => $p?->first_name,
            'middle_name' => $p?->middle_name,
            'last_name' => $p?->last_name,
            'suffix' => $p?->suffix,
            'mobile' => $p?->mobile,
            'crew_number' => $p?->crew_number,
            'rank' => $p?->rank,
            'fleet' => $p?->fleet,
            'vessel' => $p?->vessel,
            'employment_status' => $p?->employment_status,
            'date_arrive' => $p?->date_arrive?->format('Y-m-d'),
            'date_depart' => $p?->date_depart?->format('Y-m-d'),
            $this->mergeWhen($detail, ['birthday' => $p?->birthday?->format('Y-m-d')]),
        ];
    }
}

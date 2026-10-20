<?php

namespace App\Http\Requests\Tenant;

use App\Models\Membership;
use App\Support\Tenancy\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCrewRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // enforced by MembershipPolicy in the controller
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        $membership = $this->route('membership');
        $profileId = $membership instanceof Membership ? $membership->profile?->getKey() : null;

        return [
            'first_name' => ['sometimes', 'required', 'string', 'max:100'],
            'middle_name' => ['sometimes', 'nullable', 'string', 'max:100'],
            'last_name' => ['sometimes', 'required', 'string', 'max:100'],
            'suffix' => ['sometimes', 'nullable', 'string', 'max:20'],
            'mobile' => ['sometimes', 'nullable', 'string', 'max:20'],
            'crew_number' => [
                'sometimes', 'nullable', 'string', 'max:30', 'regex:/^[A-Za-z0-9._\\/-]+$/',
                Rule::unique('crew_profiles', 'crew_number')
                    ->where('tenant_id', app(TenantContext::class)->tenantId())->ignore($profileId),
            ],
            'rank' => ['sometimes', 'nullable', 'string', 'max:60'],
            'fleet' => ['sometimes', 'nullable', 'string', 'max:100'],
            'vessel' => ['sometimes', 'nullable', 'string', 'max:100'],
            'employment_status' => ['sometimes', 'nullable', 'string', 'max:60'],
            'date_arrive' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'date_depart' => ['sometimes', 'nullable', 'date_format:Y-m-d', 'after_or_equal:date_arrive'],
            'birthday' => ['sometimes', 'nullable', 'date_format:Y-m-d', 'before:today'],
        ];
    }
}

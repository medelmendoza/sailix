<?php

namespace App\Http\Requests\Tenant;

use App\Enums\Role;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateMembershipRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // enforced by MembershipPolicy in the controller
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'role' => ['sometimes', Rule::enum(Role::class)],
            'status' => ['sometimes', Rule::in(['active', 'suspended'])],
        ];
    }
}

<?php

namespace App\Http\Requests\Platform;

use Illuminate\Foundation\Http\FormRequest;

class ProvisionModuleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'external_team_id' => ['required', 'string', 'regex:/^[A-Za-z0-9_-]{1,64}$/'],
            'enabled' => ['sometimes', 'boolean'],
        ];
    }
}

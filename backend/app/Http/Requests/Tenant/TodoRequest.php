<?php

namespace App\Http\Requests\Tenant;

use Illuminate\Foundation\Http\FormRequest;

class TodoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        $create = $this->isMethod('POST');

        // Only these fields. The organization, author and done state are never taken from the request.
        return [
            'description' => [$create ? 'required' : 'sometimes', 'string', 'min:1', 'max:500'],
            'due_date' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'membership_ids' => $create ? ['required', 'array', 'min:1', 'max:200'] : ['prohibited'],
            'membership_ids.*' => ['required', 'string', 'regex:/^[0-9a-f-]{36}$/i', 'distinct'],
        ];
    }
}

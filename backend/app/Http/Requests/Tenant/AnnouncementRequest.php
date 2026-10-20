<?php

namespace App\Http\Requests\Tenant;

use Illuminate\Foundation\Http\FormRequest;

class AnnouncementRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        $required = $this->isMethod('POST') ? 'required' : 'sometimes';

        // Only these fields: the organization, author and read state are never taken from the request.
        return [
            'title' => [$required, 'string', 'min:1', 'max:150'],
            'body' => [$required, 'string', 'min:1', 'max:5000'],
            'is_active' => ['sometimes', 'boolean'],
            'expires_at' => ['sometimes', 'nullable', 'date', 'after:now'],
            // who it is for: leave out or send an empty list for everyone; otherwise only members of these fleets
            'fleets' => ['sometimes', 'nullable', 'array', 'max:30'],
            'fleets.*' => ['string', 'min:1', 'max:100', 'distinct:ignore_case'],
        ];
    }
}

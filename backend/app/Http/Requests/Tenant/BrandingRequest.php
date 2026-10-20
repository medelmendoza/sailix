<?php

namespace App\Http\Requests\Tenant;

use Illuminate\Foundation\Http\FormRequest;

class BrandingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // enforced in the controllers
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'tagline' => ['sometimes', 'nullable', 'string', 'max:120', 'regex:/^[^<>\x00-\x1f\x7f]*$/u'], // plain text only
            'primary_color' => ['sometimes', 'nullable', 'string', 'max:7'],
            'secondary_color' => ['sometimes', 'nullable', 'string', 'max:7'],
        ];
    }
}

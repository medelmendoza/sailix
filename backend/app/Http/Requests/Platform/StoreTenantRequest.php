<?php

namespace App\Http\Requests\Platform;

use App\Tenancy\TenantSlugs;
use Illuminate\Foundation\Http\FormRequest;

class StoreTenantRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('code'))) {
            $this->merge(['code' => strtoupper(trim($this->input('code')))]);
        }
        if (is_string($this->input('slug'))) {
            $this->merge(['slug' => strtolower(trim($this->input('slug')))]);
        }
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'code' => ['required', 'regex:/^[A-Z0-9]{2,32}$/', 'unique:tenants,code'],
            'name' => ['required', 'string', 'max:255'],
            // The organization's default address. Optional (it starts as the agency code); fixed once created.
            'slug' => ['sometimes', 'nullable', 'string', 'unique:tenants,slug', function ($attribute, $value, $fail) {
                if (is_string($value) && $value !== '' && ! TenantSlugs::isValid($value)) {
                    $fail('Use 3 to 40 lowercase letters, digits or single hyphens, starting and ending with a letter or digit. Names like www, api or platform are reserved.');
                }
            }],
        ];
    }
}

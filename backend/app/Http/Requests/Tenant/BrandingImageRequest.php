<?php

namespace App\Http\Requests\Tenant;

use Illuminate\Foundation\Http\FormRequest;

class BrandingImageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // enforced in the controllers
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        // The real type is decided from the content when it is stored; this only bounds the size (5 MB).
        return ['file' => ['required', 'file', 'max:5120']];
    }
}

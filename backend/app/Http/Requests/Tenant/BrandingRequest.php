<?php

namespace App\Http\Requests\Tenant;

use App\Enums\DashboardLayout;
use App\Enums\FontPreset;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
            'short_name' => ['sometimes', 'nullable', 'string', 'max:40', 'regex:/^[^<>\x00-\x1f\x7f]*$/u'],
            'login_welcome_message' => ['sometimes', 'nullable', 'string', 'max:200', 'regex:/^[^<>\x00-\x1f\x7f]*$/u'],
            'primary_color' => ['sometimes', 'nullable', 'string', 'max:7'],
            'secondary_color' => ['sometimes', 'nullable', 'string', 'max:7'],
            'accent_color' => ['sometimes', 'nullable', 'string', 'max:7'],
            'background_color' => ['sometimes', 'nullable', 'string', 'max:7'],
            'text_color' => ['sometimes', 'nullable', 'string', 'max:7'],
            'font_preset' => ['sometimes', 'nullable', Rule::enum(FontPreset::class)],
            'dashboard_layout' => ['sometimes', 'nullable', Rule::enum(DashboardLayout::class)],
        ];
    }
}

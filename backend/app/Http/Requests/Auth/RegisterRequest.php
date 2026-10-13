<?php

namespace App\Http\Requests\Auth;

use App\Identity\PasswordRules;
use Illuminate\Foundation\Http\FormRequest;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        foreach (['email', 'username', 'agency_code'] as $key) {
            if (is_string($this->input($key))) {
                $this->merge([$key => trim($this->input($key))]);
            }
        }
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'agency_code' => ['required', 'string', 'max:32', 'regex:/^[A-Za-z0-9]+$/'],
            'username' => ['required', 'string', 'regex:/^[A-Za-z0-9._-]{3,64}$/'],
            'email' => ['required', 'email:rfc', 'max:255'],
            // Policy is the platform minimum raised by the target organization's stricter minimum (Q-5).
            'password' => ['required', 'string', 'confirmed', 'max:1024', PasswordRules::forAgencyCode($this->input('agency_code'))],
            'first_name' => ['required', 'string', 'max:100'],
            'middle_name' => ['nullable', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'suffix' => ['nullable', 'string', 'max:20'],
            'mobile' => ['nullable', 'string', 'regex:/^\+?[0-9 ()-]{7,20}$/'],
        ];
    }
}

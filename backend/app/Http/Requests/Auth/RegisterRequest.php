<?php

namespace App\Http\Requests\Auth;

use App\Identity\PasswordRules;
use App\Tenancy\AddressedTenant;
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
        // On an organization's own address the address names the agency; a code naming another one is refused below.
        $addressed = app(AddressedTenant::class)->get();
        if ($addressed && ! is_string($this->input('agency_code')) || $addressed && $this->input('agency_code') === '') {
            $this->merge(['agency_code' => $addressed->code]);
        }
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'agency_code' => ['required', 'string', 'max:32', 'regex:/^[A-Za-z0-9]+$/', function ($attribute, $value, $fail) {
                $addressed = app(AddressedTenant::class)->get();
                if ($addressed && is_string($value) && strtoupper($value) !== strtoupper($addressed->code)) {
                    $fail('The agency code does not match this address.');
                }
            }],
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

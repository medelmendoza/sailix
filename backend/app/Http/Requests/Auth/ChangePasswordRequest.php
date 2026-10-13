<?php

namespace App\Http\Requests\Auth;

use App\Identity\PasswordRules;
use Illuminate\Foundation\Http\FormRequest;

class ChangePasswordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'current_password' => ['required', 'string', 'max:1024'],
            'password' => ['required', 'string', 'confirmed', 'max:1024', 'different:current_password', PasswordRules::forUser($this->user())],
        ];
    }
}

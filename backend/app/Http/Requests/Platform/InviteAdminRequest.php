<?php

namespace App\Http\Requests\Platform;

use Illuminate\Foundation\Http\FormRequest;

class InviteAdminRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'email' => ['required', 'email', 'max:255'],
            'username' => ['nullable', 'string', 'max:64', 'regex:/^[A-Za-z0-9._-]+$/', 'unique:users,username'],
            'display_name' => ['nullable', 'string', 'max:120'],
        ];
    }
}

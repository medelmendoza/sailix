<?php

namespace App\Http\Requests\Modules;

use Illuminate\Foundation\Http\FormRequest;

class LinkTalaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        // Only these two fields exist: no user id, team id or role can be supplied.
        return ['username' => ['required', 'string', 'max:255'], 'password' => ['required', 'string', 'max:255']];
    }
}

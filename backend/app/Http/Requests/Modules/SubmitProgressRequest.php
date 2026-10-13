<?php

namespace App\Http\Requests\Modules;

use Illuminate\Foundation\Http\FormRequest;

class SubmitProgressRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        // Only completion of named materials: no score, comment, name or status text can be supplied.
        return [
            'completed' => ['required', 'array', 'min:1', 'max:50'],
            'completed.*' => ['required', 'string', 'regex:/^[A-Za-z0-9_-]{1,64}$/'],
        ];
    }
}

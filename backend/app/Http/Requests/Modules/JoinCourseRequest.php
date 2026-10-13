<?php

namespace App\Http\Requests\Modules;

use Illuminate\Foundation\Http\FormRequest;

class JoinCourseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        // Only a code. The Tala user and team always come from the stored link, never from the request.
        return ['code' => ['required', 'string', 'regex:/^[A-Za-z0-9_-]{3,64}$/']];
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('code'))) {
            $this->merge(['code' => trim($this->input('code'))]);
        }
    }
}

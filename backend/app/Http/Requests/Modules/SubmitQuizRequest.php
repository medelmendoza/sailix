<?php

namespace App\Http\Requests\Modules;

use Illuminate\Foundation\Http\FormRequest;

class SubmitQuizRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        // Answers only. A score, a result, a status or a user id cannot be supplied: the server computes them.
        return [
            'version' => ['nullable', 'string', 'max:32'],
            'answers' => ['required', 'array', 'min:1', 'max:200'],
            'answers.*' => ['required', 'array:ref,value'],
            'answers.*.ref' => ['required', 'string', 'regex:/^\d{1,3}\.\d{1,3}$/'],
            'answers.*.value' => ['required'],
        ];
    }
}

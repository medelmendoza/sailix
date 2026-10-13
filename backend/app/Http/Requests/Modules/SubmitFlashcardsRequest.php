<?php

namespace App\Http\Requests\Modules;

use Illuminate\Foundation\Http\FormRequest;

class SubmitFlashcardsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        // A rating per card index, nothing else: card text, counts and status are built by the server from Tala's deck.
        return [
            'version' => ['nullable', 'string', 'max:32'],
            'ratings' => ['required', 'array', 'min:1', 'max:500'],
            'ratings.*' => ['required', 'array:index,rating'],
            'ratings.*.index' => ['required', 'integer', 'min:0', 'max:499'],
            'ratings.*.rating' => ['required', 'string', 'in:easy,medium,hard'],
        ];
    }
}

<?php

namespace App\Http\Requests\Platform;

use App\Enums\Feature;
use Illuminate\Foundation\Http\FormRequest;

class UpdateFeaturesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'features' => ['required', 'array', 'min:1'],
            'features.*' => ['boolean'],
        ];
    }

    /** @return list<\Closure> */
    public function after(): array
    {
        return [function ($validator) {
            $known = array_map(fn (Feature $f) => $f->value, Feature::cases());
            foreach (array_keys((array) $this->input('features', [])) as $code) {
                if (! in_array($code, $known, true)) {
                    $validator->errors()->add("features.$code", 'Unknown feature.');
                }
            }
        }];
    }
}

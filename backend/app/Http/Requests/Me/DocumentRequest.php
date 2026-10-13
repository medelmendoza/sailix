<?php

namespace App\Http\Requests\Me;

use App\Support\DocumentFiles;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class DocumentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * An expiry before the issue date is a typing mistake; refuse it with a message on the field.
     *
     * @return array<int, \Closure(Validator): void>
     */
    public function after(): array
    {
        return [function ($validator) {
            $issued = $this->input('issued_on');
            $expires = $this->input('expires_on');
            if (is_string($issued) && is_string($expires) && $issued !== '' && $expires !== '' && $expires < $issued) {
                $validator->errors()->add('expires_on', 'The expiry date cannot be before the issue date.');
            }
        }];
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        $new = $this->routeIs('documents.store');

        // The owner, organization, status and review fields are never taken from the request.
        return [
            'document_type_id' => [$new ? 'required' : 'sometimes', 'string', 'regex:/^[0-9a-f-]{36}$/i'],
            'number' => ['sometimes', 'nullable', 'string', 'max:80'],
            'grade' => ['sometimes', 'nullable', 'string', 'max:80'],
            'location' => ['sometimes', 'nullable', 'string', 'max:120'],
            'school' => ['sometimes', 'nullable', 'string', 'max:120'],
            'issued_on' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'expires_on' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'file' => [$new ? 'required' : 'sometimes', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:'.DocumentFiles::maxKilobytes()],
        ];
    }
}

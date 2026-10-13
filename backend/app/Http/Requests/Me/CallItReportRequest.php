<?php

namespace App\Http\Requests\Me;

use App\Models\CallItReport;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CallItReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Each field is checked for what it may contain. Whether the report is COMPLETE is checked when it is submitted, on the
     * stored draft plus these changes (so a draft can be finished and sent with just `submit`). The reporter, organization
     * and status are never taken from the request.
     *
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'classification' => ['sometimes', 'nullable', Rule::in(CallItReport::CLASSIFICATIONS)],
            'sub_classification' => ['sometimes', 'nullable', Rule::in(CallItReport::SUB_CLASSIFICATIONS)],
            'location' => ['sometimes', 'nullable', Rule::in(CallItReport::LOCATIONS)],
            'location_other' => ['sometimes', 'nullable', 'string', 'max:120'],
            'vessel' => ['sometimes', 'nullable', 'string', 'max:120'],
            'details' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'intervened' => ['sometimes', 'boolean'],
            'intervention_details' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'official_report' => ['sometimes', 'boolean'],
            'submit' => ['sometimes', 'boolean'],
        ];
    }
}

<?php

namespace App\Http\Requests\Tenant;

use App\Modules\Module;
use Illuminate\Foundation\Http\FormRequest;

class SetModuleEnabledRequest extends FormRequest
{
    public function authorize(): bool
    {
        $module = $this->route('module');

        return $module instanceof Module && ($this->user()?->can($module->manageAbility()) ?? false);
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return ['enabled' => ['required', 'boolean']];
    }
}

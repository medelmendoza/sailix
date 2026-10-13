<?php

namespace App\Http\Requests\Tenant;

use App\Support\Settings\SettingsRegistry;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\ValidationException;

class UpdateTenantRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('tenant.manage') ?? false;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return ['settings' => ['required', 'array', 'min:1']];
    }

    /** @return array<string, mixed> */
    public function settings(): array
    {
        $this->validated();
        $values = SettingsRegistry::validate($this->input('settings'), 'tenant');

        $floor = (int) SettingsRegistry::platform('password_min_length');
        if (isset($values['password_min_length']) && (int) $values['password_min_length'] < $floor) {
            throw ValidationException::withMessages(['password_min_length' => "May not be lower than the platform minimum ($floor)."]);
        }

        return $values;
    }
}

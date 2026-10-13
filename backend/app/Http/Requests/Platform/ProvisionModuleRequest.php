<?php

namespace App\Http\Requests\Platform;

use App\Modules\Module;
use Illuminate\Foundation\Http\FormRequest;

class ProvisionModuleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        $route = $this->route('module');
        $module = $route instanceof Module ? $route : Module::tryFrom((string) $route);

        return [
            // A module that talks to an upstream system needs the team it is mapped to; a built-in one takes none.
            'external_team_id' => $module?->requiresEndpoint() === false
                ? ['prohibited']
                : ['required', 'string', 'regex:/^[A-Za-z0-9_-]{1,64}$/'],
            'enabled' => ['sometimes', 'boolean'],
        ];
    }
}

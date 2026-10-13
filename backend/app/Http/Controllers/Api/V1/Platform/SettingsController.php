<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\UpdateSettingsRequest;
use App\Support\Audit;
use App\Support\Settings\SettingsRegistry;
use Illuminate\Http\JsonResponse;

class SettingsController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json(['data' => $this->payload()]);
    }

    public function update(UpdateSettingsRequest $request): JsonResponse
    {
        $values = SettingsRegistry::validate($request->input('settings'), 'platform');
        foreach ($values as $key => $value) {
            SettingsRegistry::setPlatform($key, $value);
        }
        Audit::record('platform.settings_updated', null, null, ['keys' => array_keys($values)]);

        return response()->json(['data' => $this->payload()]);
    }

    /** @return array<string, mixed> */
    private function payload(): array
    {
        $out = [];
        foreach (SettingsRegistry::definitions() as $key => $def) {
            if (in_array($def['scope'], ['platform', 'both'], true)) {
                $out[$key] = SettingsRegistry::platform($key);
            }
        }

        return $out;
    }
}

<?php

namespace App\Support;

use App\Support\Settings\SettingsRegistry;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * Server-enforced "enter your password again" before payslips open (docs/16). It replaces the old client-side birthdate
 * check, which anyone holding the phone could pass and which the server never saw. The unlock belongs to ONE sign-in
 * (its token or web session) and one membership, lasts a few minutes, and a different device or sign-in starts locked.
 */
final class FinanceStepUp
{
    public static function required(): bool
    {
        return SettingsRegistry::tenant('payslip_step_up') !== 'none';
    }

    public static function ttl(): int
    {
        return max(60, (int) config('sailix.finance_unlock_ttl', 300));
    }

    public static function unlocked(Request $request): bool
    {
        return ! self::required() || Cache::has(self::key($request));
    }

    public static function unlock(Request $request): void
    {
        Cache::put(self::key($request), true, self::ttl());
    }

    private static function key(Request $request): string
    {
        $user = $request->user();
        $token = $user?->currentAccessToken();
        $signIn = $token instanceof PersonalAccessToken
            ? 'T'.$token->getKey()
            : 'S'.($request->hasSession() ? $request->session()->getId() : 'none');

        return 'finance-unlock:'.$user?->getKey().':'.$signIn;
    }
}

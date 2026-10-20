<?php

namespace App\Support;

/**
 * Whether a superadmin must give a one-time code to sign in. Always yes, except on a development machine where the
 * environment explicitly switches it off (SAILIX_PLATFORM_REQUIRE_OTP=false). Anywhere else (production, staging...)
 * the switch is ignored, so it cannot be left on by accident.
 */
final class PlatformMfa
{
    public static function required(): bool
    {
        if (! app()->environment(['local', 'testing'])) {
            return true;
        }

        return (bool) config('sailix.platform.require_otp', true);
    }
}

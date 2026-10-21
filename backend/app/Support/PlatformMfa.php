<?php

namespace App\Support;

/**
 * Whether a superadmin must give a one-time code to sign in. Always yes, except on a development or staging machine where
 * the environment explicitly switches it off (SAILIX_PLATFORM_REQUIRE_OTP=false). In production the switch is ignored, so
 * it cannot be left on by accident. A staging server that other people can reach should not carry the switch.
 */
final class PlatformMfa
{
    public static function required(): bool
    {
        if (! app()->environment(['local', 'testing', 'staging'])) {
            return true;
        }

        return (bool) config('sailix.platform.require_otp', true);
    }
}

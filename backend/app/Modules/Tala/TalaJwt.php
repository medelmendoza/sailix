<?php

namespace App\Modules\Tala;

use Illuminate\Support\Carbon;

/** Reads the `exp` claim of a Tala token WITHOUT trusting it for anything but a "relink soon" hint. */
final class TalaJwt
{
    public static function expiry(string $jwt): ?Carbon
    {
        $parts = explode('.', $jwt);
        if (count($parts) !== 3) {
            return null;
        }
        $payload = json_decode((string) base64_decode(strtr($parts[1], '-_', '+/'), false), true);
        $exp = is_array($payload) ? ($payload['exp'] ?? null) : null;

        return is_int($exp) || is_float($exp) ? Carbon::createFromTimestamp((int) $exp) : null;
    }
}

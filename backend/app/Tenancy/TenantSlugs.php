<?php

namespace App\Tenancy;

use App\Models\Tenant;

/** What a slug may look like, and a safe one to start from. */
final class TenantSlugs
{
    public const RESERVED = ['www', 'api', 'admin', 'platform', 'app', 'mail', 'static', 'assets', 'cdn', 'sailix', 'login', 'status', 'help', 'support'];

    public const PATTERN = '/^[a-z0-9](?:[a-z0-9]|-(?!-))*[a-z0-9]$/'; // 3-40, no "--", starts and ends alphanumeric

    public static function isValid(string $slug): bool
    {
        return strlen($slug) >= 3 && strlen($slug) <= 40
            && preg_match(self::PATTERN, $slug) === 1
            && ! in_array($slug, self::RESERVED, true);
    }

    /** The lowercase agency code, made valid ("AB" becomes "ab-org") and unique. */
    public static function suggest(string $code): string
    {
        $base = trim((string) preg_replace('/[^a-z0-9-]/', '', strtolower($code)), '-');
        if (strlen($base) < 3 || in_array($base, self::RESERVED, true)) {
            $base = ($base === '' ? 'org' : $base).'-org';
        }
        $slug = substr($base, 0, 40);
        for ($n = 2; Tenant::where('slug', $slug)->exists(); $n++) {
            $slug = substr($base, 0, 36).'-'.$n;
        }

        return $slug;
    }
}

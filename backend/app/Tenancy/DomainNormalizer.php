<?php

namespace App\Tenancy;

/**
 * One canonical spelling of a host name, so "Example.com", "example.com.", "WWW.example.com:8443" and "www.example.com"
 * are all the same domain: trim, lowercase, drop the port and a trailing dot, convert to punycode, strip one "www.".
 */
final class DomainNormalizer
{
    public static function normalize(?string $raw): ?string
    {
        if ($raw === null) {
            return null;
        }
        $host = strtolower(trim($raw));
        if ($host === '' || str_contains($host, '/') || str_contains($host, '@') || str_contains($host, ' ')) {
            return null;
        }
        if (str_starts_with($host, '[')) {
            return null; // IPv6 literal: never a tenant host
        }
        $host = preg_replace('/:\d{1,5}$/', '', $host) ?? $host;
        $host = rtrim($host, '.');
        if ($host === '') {
            return null;
        }
        if (preg_match('/[^\x00-\x7f]/', $host) === 1) {
            $ascii = function_exists('idn_to_ascii') ? idn_to_ascii($host, IDNA_DEFAULT, INTL_IDNA_VARIANT_UTS46) : false;
            if ($ascii === false || $ascii === '') {
                return null;
            }
            $host = strtolower($ascii);
        }
        if (str_starts_with($host, 'www.') && substr_count($host, '.') >= 2) {
            $host = substr($host, 4);
        }

        return preg_match('/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/', $host) === 1 && strlen($host) <= 253 ? $host : null;
    }

    /** A name a customer could own: at least two labels, not an IP address, not localhost. */
    public static function isRegistrable(string $domain): bool
    {
        return substr_count($domain, '.') >= 1
            && filter_var($domain, FILTER_VALIDATE_IP) === false
            && $domain !== 'localhost'
            && ! str_ends_with($domain, '.localhost')
            && preg_match('/^[a-z0-9.-]+\.[a-z]{2,}$/', $domain) === 1;
    }
}

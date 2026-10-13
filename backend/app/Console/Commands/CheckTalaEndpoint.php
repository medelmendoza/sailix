<?php

namespace App\Console\Commands;

use App\Modules\Tala\TalaEndpointGuard;
use App\Modules\Tala\UnsafeEndpoint;
use App\Support\Settings\SettingsRegistry;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Deployment gate for the Tala upstream (docs/13 D-T2, docs/14). Offline checks always run; `--live` additionally makes ONE
 * unauthenticated HTTPS request to the origin to prove the certificate verifies. Never sends credentials.
 */
class CheckTalaEndpoint extends Command
{
    protected $signature = 'sailix:tala:check {--live : Also request the origin once (no credentials) to verify TLS}';

    protected $description = 'Verify the configured Tala endpoint is approved, HTTPS-only and (optionally) reachable with a valid certificate.';

    public function handle(TalaEndpointGuard $guard): int
    {
        $base = SettingsRegistry::platform('tala_api_base_url');
        if (! is_string($base) || $base === '') {
            $this->error('FAIL  platform setting tala_api_base_url is not set (the gateway stays closed: 503 module_unavailable).');

            return self::FAILURE;
        }
        try {
            $safe = $guard->assertSafe($base);
        } catch (UnsafeEndpoint $e) {
            $this->error("FAIL  endpoint rejected: {$e->reason}");

            return self::FAILURE;
        }
        $this->info("OK    {$safe['origin']} is https, allow-listed and resolves only to public addresses (".count($safe['addresses']).').');

        if (! $this->option('live')) {
            $this->line('SKIP  live TLS check (use --live).');

            return self::SUCCESS;
        }
        try {
            $response = Http::connectTimeout(5)->timeout(10)->withOptions(['allow_redirects' => false, 'verify' => true, 'curl' => [CURLOPT_RESOLVE => ["{$safe['host']}:443:{$safe['addresses'][0]}"]]])->get($safe['origin'].'/');
        } catch (Throwable) {
            $this->error('FAIL  could not complete a verified TLS connection.');

            return self::FAILURE;
        }
        $this->info("OK    verified TLS connection (HTTP {$response->status()}).");
        $hsts = $response->header('Strict-Transport-Security');
        $this->line($hsts !== '' ? 'OK    upstream sends HSTS.' : 'WARN  upstream does not send HSTS.');

        return self::SUCCESS;
    }
}

<?php

namespace Tests\Feature;

use App\Models\PlatformAdmin;
use App\Models\Tenant;
use Database\Seeders\DatabaseSeeder;
use PragmaRX\Google2FA\Google2FA;
use Tests\TestCase;

/** The documented demo credentials must really work, so browser/E2E checks are reproducible. */
class DemoSeederTest extends TestCase
{
    public function test_documented_demo_accounts_can_sign_in(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->postJson('/api/v1/auth/token', ['username' => 'admin.sfai', 'password' => 'demo-password-123', 'device_name' => 't'])->assertOk();

        $otp = (new Google2FA)->getCurrentOtp(DatabaseSeeder::DEMO_TOTP_SECRET);
        $this->spa()->postJson('/api/v1/platform/auth/session', ['email' => 'root@example.test', 'password' => 'demo-password-123', 'otp' => $otp])->assertOk();
    }

    public function test_seeding_twice_is_idempotent(): void
    {
        $this->seed(DatabaseSeeder::class);
        $this->seed(DatabaseSeeder::class);

        $this->assertSame(1, PlatformAdmin::count());
        $this->assertSame(2, Tenant::count());
    }

    public function test_the_seeder_refuses_to_run_outside_local_and_testing(): void
    {
        $this->app['env'] = 'production';

        (new DatabaseSeeder)->run(); // direct call: no console output object in this test

        $this->assertSame(0, PlatformAdmin::count());
        $this->assertSame(0, Tenant::count());
    }
}

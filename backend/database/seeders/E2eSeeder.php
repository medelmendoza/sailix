<?php

namespace Database\Seeders;

use App\Enums\MembershipStatus;
use App\Enums\Role;
use App\Enums\TenantStatus;
use App\Enums\UserStatus;
use App\Models\Membership;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Data for the browser end-to-end suite (web/e2e) ONLY. Runs against the dedicated `sailix_e2e` database,
 * refuses to run outside local/testing, and takes its password and TOTP secret from the environment
 * (the Playwright runner generates both randomly for every run; nothing here is a usable credential).
 *
 * Adds to the demo tenants: `multi.user` (tenant admin in SFAI and ACME) and tenant ZETA with its own admin,
 * so state-changing tests (suspension) never touch the tenants the other tests rely on.
 */
class E2eSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            $this->command?->error('The e2e seeder only runs in local/testing environments.');

            return;
        }
        if (! env('SEED_DEMO_PASSWORD') || ! env('SEED_DEMO_TOTP_SECRET')) {
            $this->command?->error('Set SEED_DEMO_PASSWORD and SEED_DEMO_TOTP_SECRET (the e2e runner does this).');

            return;
        }

        $this->call(DatabaseSeeder::class);
        $password = env('SEED_DEMO_PASSWORD');

        $zeta = Tenant::firstOrNew(['code' => 'ZETA']);
        $zeta->name = 'Zeta Maritime (e2e)';
        $zeta->forceFill(['status' => TenantStatus::Active, 'activated_at' => now()])->save();

        $members = [
            'admin.zeta' => ['ZETA' => Role::TenantAdmin],
            'multi.user' => ['SFAI' => Role::TenantAdmin, 'ACME' => Role::TenantAdmin],
        ];
        foreach ($members as $username => $roles) {
            $user = User::firstOrNew(['username' => $username]);
            $user->forceFill(['email' => "$username@example.test", 'password' => $password, 'status' => UserStatus::Active])->save();
            foreach ($roles as $code => $role) {
                $tenant = Tenant::where('code', $code)->firstOrFail();
                $membership = Membership::withoutTenantScope()->firstOrNew(['tenant_id' => $tenant->getKey(), 'user_id' => $user->getKey()]);
                $membership->forceFill(['tenant_id' => $tenant->getKey(), 'role' => $role->value, 'status' => MembershipStatus::Active])->save();
            }
        }
    }
}

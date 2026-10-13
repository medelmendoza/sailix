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
 * LOCAL DEVELOPMENT ONLY. Two demo tenants for manual testing and isolation work.
 * Refuses to run outside local/testing. The password is a dev placeholder, not a secret.
 */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            $this->command?->error('The demo seeder only runs in local/testing environments.');

            return;
        }

        $password = env('SEED_DEMO_PASSWORD', 'demo-password-123');

        foreach (['SFAI' => 'Southfield Agencies (demo)', 'ACME' => 'Acme Crewing (demo)'] as $code => $name) {
            $tenant = Tenant::firstOrNew(['code' => $code]);
            $tenant->name = $name;
            $tenant->forceFill(['status' => TenantStatus::Active, 'activated_at' => now()])->save();

            foreach ([Role::TenantAdmin->value => 'admin', Role::Crew->value => 'crew'] as $role => $prefix) {
                $username = strtolower("{$prefix}.{$code}");
                $user = User::firstOrNew(['username' => $username]);
                $user->forceFill(['email' => "$username@example.test", 'password' => $password, 'status' => UserStatus::Active])->save();

                $membership = Membership::withoutTenantScope()->firstOrNew(['tenant_id' => $tenant->getKey(), 'user_id' => $user->getKey()]);
                $membership->forceFill(['tenant_id' => $tenant->getKey(), 'role' => $role, 'status' => MembershipStatus::Active])->save();
            }
        }

        $this->command?->info('Demo tenants SFAI and ACME seeded (admin.<code> / crew.<code>). Create a superadmin with: php artisan platform:create-admin');
    }
}

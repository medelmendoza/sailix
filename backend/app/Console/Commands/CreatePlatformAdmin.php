<?php

namespace App\Console\Commands;

use App\Enums\UserStatus;
use App\Models\PlatformAdmin;
use App\Support\Audit;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use PragmaRX\Google2FA\Google2FA;

class CreatePlatformAdmin extends Command
{
    protected $signature = 'platform:create-admin {email} {name}';

    protected $description = 'Create a superadmin with TOTP MFA (secret is shown once).';

    public function handle(): int
    {
        $email = (string) $this->argument('email');
        Validator::make(['email' => $email], ['email' => ['required', 'email', 'unique:platform_admins,email']])->validate();

        $password = $this->secret('Password (min 12 chars)');
        if (mb_strlen((string) $password) < 12 || $password !== $this->secret('Confirm password')) {
            $this->error('Password too short or confirmation mismatch.');

            return self::FAILURE;
        }

        $google = new Google2FA;
        $secret = $google->generateSecretKey(32);
        $admin = new PlatformAdmin(['name' => (string) $this->argument('name'), 'email' => $email, 'password' => $password]);
        $admin->forceFill(['status' => UserStatus::Active, 'totp_secret' => $secret, 'totp_confirmed_at' => now()])->save();
        Audit::record('platform.admin_created', null, $admin, ['via' => 'cli'], null);

        $this->info('Superadmin created. Enroll this TOTP secret in an authenticator app NOW (shown once):');
        $this->line($secret);
        $this->line($google->getQRCodeUrl(config('app.name'), $email, $secret));

        return self::SUCCESS;
    }
}

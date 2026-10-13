<?php

namespace App\Platform;

use App\Enums\MembershipStatus;
use App\Enums\Role;
use App\Enums\TenantStatus;
use App\Enums\UserStatus;
use App\Mail\TenantAdminInvitation;
use App\Models\Invitation;
use App\Models\Membership;
use App\Models\Tenant;
use App\Models\User;
use App\Support\ApiProblem;
use App\Support\Audit;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

/** Creates (or reuses) a user, an invited tenant_admin membership, and a one-time invitation. */
final class TenantAdminInviter
{
    /** @return array{membership: Membership, token: string} */
    public function invite(Tenant $tenant, string $email, ?string $username, ?string $displayName): array
    {
        if (in_array($tenant->status, [TenantStatus::Deactivated, TenantStatus::Archived], true)) {
            throw ApiProblem::conflict('invalid_transition', 'Cannot invite administrators to an inactive tenant.');
        }

        [$membership, $token] = DB::transaction(function () use ($tenant, $email, $username, $displayName) {
            $user = User::where('email', $email)->first();

            if (! $user) {
                $user = new User([
                    'username' => $username ?? Str::before($email, '@'),
                    'email' => $email,
                    'display_name' => $displayName,
                    'password' => Str::random(40),
                ]);
                $user->forceFill(['status' => UserStatus::Invited])->save();
            }

            $existing = Membership::withoutTenantScope()
                ->where('tenant_id', $tenant->getKey())->where('user_id', $user->getKey())->first();
            if ($existing && $existing->status === MembershipStatus::Active) {
                throw ApiProblem::conflict('already_member', 'This user is already a member of the tenant.');
            }

            $membership = $existing ?? (new Membership)->forceFill([
                'tenant_id' => $tenant->getKey(),
                'user_id' => $user->getKey(),
            ]);
            $membership->forceFill(['role' => Role::TenantAdmin, 'status' => MembershipStatus::Invited])->save();

            $secret = Str::random(48);
            $invitation = (new Invitation)->forceFill([
                'tenant_id' => $tenant->getKey(),
                'membership_id' => $membership->getKey(),
                'token_hash' => hash('sha256', $secret),
                'expires_at' => now()->addHours(config('sailix.invitation_ttl_hours')),
            ]);
            $invitation->save();

            Audit::record('tenant.admin_invited', $tenant->getKey(), $membership, ['email' => $email]);

            return [$membership, $invitation->getKey().'.'.$secret];
        });

        $origin = rtrim((string) (config('sailix.web_origins')[0] ?? config('app.url')), '/');
        Mail::to($email)->send(new TenantAdminInvitation($tenant->name, "$origin/accept-invitation?token=".urlencode($token)));

        return ['membership' => $membership, 'token' => $token];
    }
}

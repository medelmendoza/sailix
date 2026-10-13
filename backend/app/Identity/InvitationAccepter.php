<?php

namespace App\Identity;

use App\Enums\MembershipStatus;
use App\Enums\UserStatus;
use App\Models\Invitation;
use App\Models\Membership;
use App\Models\User;
use App\Support\ApiProblem;
use App\Support\Audit;
use Illuminate\Support\Facades\DB;

final class InvitationAccepter
{
    public function accept(string $token, string $password): void
    {
        [$id, $secret] = array_pad(explode('.', $token, 2), 2, '');
        $invalid = new ApiProblem(422, 'invalid_invitation', 'The invitation is invalid or has expired.');

        DB::transaction(function () use ($id, $secret, $password, $invalid) {
            $invitation = $id !== '' ? Invitation::withoutTenantScope()->whereKey($id)->lockForUpdate()->first() : null;

            if (! $invitation || $invitation->accepted_at !== null || $invitation->expires_at->isPast()
                || ! hash_equals($invitation->token_hash, hash('sha256', $secret))) {
                throw $invalid;
            }

            $membership = Membership::withoutTenantScope()->with('tenant')->findOrFail($invitation->membership_id);
            $user = User::findOrFail($membership->user_id);

            // Only an invited (never-activated) user sets a password through an invitation.
            if ($user->status === UserStatus::Invited) {
                $user->forceFill(['password' => $password, 'status' => UserStatus::Active, 'email_verified_at' => now()])->save();
            }
            $membership->forceFill(['status' => MembershipStatus::Active])->save();
            $invitation->forceFill(['accepted_at' => now()])->save();

            Audit::record('tenant.admin_activated', $membership->tenant_id, $membership, [], $user);
        });
    }
}

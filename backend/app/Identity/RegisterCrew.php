<?php

namespace App\Identity;

use App\Enums\MembershipStatus;
use App\Enums\Role;
use App\Enums\TenantStatus;
use App\Enums\UserStatus;
use App\Mail\RegistrationNotice;
use App\Models\CrewProfile;
use App\Models\Membership;
use App\Models\Tenant;
use App\Models\User;
use App\Support\ApiProblem;
use App\Support\Audit;
use App\Support\SafeMailer;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Self-registration (docs/02 §4, docs/13 §3.2). Creates a login identity, a PENDING `crew` membership in the
 * organization named by the agency code, and its per-organization profile. Nothing the client sends can choose
 * the role, the status or the tenant: those are fixed here. No token is issued; a tenant admin activates the member.
 */
final class RegisterCrew
{
    /** @param array<string, mixed> $data validated request data */
    public function __invoke(array $data): void
    {
        $tenant = Tenant::where('code', strtoupper((string) $data['agency_code']))
            ->where('status', TenantStatus::Active)->first()
            ?? throw new ApiProblem(422, 'invalid_agency_code', 'The agency code is not valid.', ['agency_code' => ['The agency code is not valid.']]);

        // An email that already has an account never gets a second one and is never revealed to the caller:
        // the owner is told by email instead, and the response is identical. (Hashing keeps timing comparable.)
        if (User::where('email', $data['email'])->exists()) {
            Hash::make((string) $data['password']);
            SafeMailer::send((string) $data['email'], new RegistrationNotice(
                rtrim((string) (config('sailix.web_origins')[0] ?? config('app.url')), '/').'/forgot-password',
            ));
            Audit::record('auth.register_existing_email', $tenant->getKey());

            return;
        }

        if (User::where('username', $data['username'])->exists()) {
            throw new ApiProblem(422, 'validation', 'The given data was invalid.', ['username' => ['The username has already been taken.']]);
        }

        DB::transaction(function () use ($data, $tenant): void {
            $user = new User(['username' => $data['username'], 'email' => $data['email'], 'password' => $data['password']]);
            $user->forceFill(['status' => UserStatus::Active])->save();

            $membership = (new Membership)->forceFill([
                'tenant_id' => $tenant->getKey(), 'user_id' => $user->getKey(),
                'role' => Role::Crew, 'status' => MembershipStatus::Pending,
            ]);
            $membership->save();

            (new CrewProfile)->forceFill([
                'tenant_id' => $tenant->getKey(), 'membership_id' => $membership->getKey(),
                'first_name' => $data['first_name'], 'middle_name' => $data['middle_name'] ?? null,
                'last_name' => $data['last_name'], 'suffix' => $data['suffix'] ?? null, 'mobile' => $data['mobile'] ?? null,
            ])->save();

            Audit::record('auth.registered', $tenant->getKey(), $membership, [], $user);
        });
    }
}

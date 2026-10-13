<?php

namespace App\Identity;

use App\Enums\MembershipStatus;
use App\Models\Membership;
use App\Models\User;
use App\Support\ApiProblem;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Hash;

/**
 * Credential check + membership resolution shared by the token (mobile) and session (web) logins.
 * Failure responses for unknown user / wrong password are identical (docs/04, T17).
 */
final class LoginFlow
{
    public function __construct(private MembershipDirectory $directory, private LoginTickets $tickets) {}

    /**
     * @return array{user: User, membership: ?Membership, ticket: ?string, memberships: Collection<int, Membership>}
     */
    public function begin(string $identifier, string $password, ?string $agencyCode, string $channel): array
    {
        $user = $this->verifyCredentials($identifier, $password);

        $all = $this->directory->forUser($user, $agencyCode);
        $usable = $all->filter(fn (Membership $m) => MembershipDirectory::isUsable($m))
            ->when($channel === 'session', fn ($c) => $c->filter(fn (Membership $m) => $m->role->canUseWeb()))
            ->values();

        if ($usable->isEmpty()) {
            throw $this->noAccess($all, $channel);
        }

        if ($usable->count() === 1) {
            return ['user' => $user, 'membership' => $usable->first(), 'ticket' => null, 'memberships' => $usable];
        }

        $ticket = $this->tickets->issue($user->getKey(), $usable->pluck('id')->all(), $channel);

        return ['user' => $user, 'membership' => null, 'ticket' => $ticket, 'memberships' => $usable];
    }

    /** @return array{user: User, membership: Membership} */
    public function complete(string $ticket, string $membershipId, string $channel): array
    {
        $payload = $this->tickets->consume($ticket, $channel)
            ?? throw new ApiProblem(401, 'invalid_ticket', 'The login ticket is invalid or expired.');

        $user = User::find($payload['user_id']);
        $membership = $user && in_array($membershipId, $payload['membership_ids'], true)
            ? $this->directory->findForUser($membershipId, $user)
            : null;

        if (! $user || ! $membership || ! MembershipDirectory::isUsable($membership)) {
            throw new ApiProblem(403, 'forbidden', 'You cannot select that organization.');
        }

        return ['user' => $user, 'membership' => $membership];
    }

    private function verifyCredentials(string $identifier, string $password): User
    {
        $user = User::where('username', $identifier)->orWhere('email', $identifier)->first();

        // Constant-ish time: always run one hash check.
        static $dummy = null;
        $dummy ??= Hash::make('not-a-real-password');
        $hash = $user->password ?? $dummy;
        $ok = Hash::check($password, $hash);

        if (! $user || ! $ok) {
            throw new ApiProblem(401, 'invalid_credentials', 'The credentials are incorrect.');
        }
        if (! $user->isActive()) {
            throw ApiProblem::forbidden('account_suspended', 'This account cannot sign in.');
        }

        return $user;
    }

    /** @param Collection<int, Membership> $all */
    private function noAccess(Collection $all, string $channel): ApiProblem
    {
        if ($all->contains(fn (Membership $m) => $m->status === MembershipStatus::Pending)) {
            return ApiProblem::forbidden('membership_pending', 'Your account is awaiting activation by your organization.');
        }
        if ($all->contains(fn (Membership $m) => $m->isActive() && ! $m->tenant->isActive())) {
            return ApiProblem::forbidden('tenant_suspended', 'Your organization is not active.');
        }
        if ($channel === 'session' && $all->contains(fn (Membership $m) => MembershipDirectory::isUsable($m))) {
            return ApiProblem::forbidden('web_access_denied', 'This account cannot use the web portal.');
        }

        return ApiProblem::forbidden('no_access', 'This account has no active organization.');
    }
}

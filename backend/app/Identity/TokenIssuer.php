<?php

namespace App\Identity;

use App\Models\Membership;
use App\Models\PersonalAccessToken;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/** Issues/revokes mobile tokens bound to a membership. */
final class TokenIssuer
{
    /** @return array{plain: string, token: PersonalAccessToken} */
    public function issue(User $user, Membership $membership, string $deviceName, ?CarbonInterface $chainStartedAt = null): array
    {
        return DB::transaction(function () use ($user, $membership, $deviceName, $chainStartedAt) {
            $new = $user->createToken(
                mb_substr($deviceName, 0, 120),
                ['*'],
                now()->addDays(config('sailix.token_ttl_days')),
            );
            /** @var PersonalAccessToken $token */
            $token = $new->accessToken;
            $token->forceFill([
                'tenant_id' => $membership->tenant_id,
                'membership_id' => $membership->getKey(),
                'chain_started_at' => $chainStartedAt ?? now(),
            ])->save();

            return ['plain' => $new->plainTextToken, 'token' => $token];
        });
    }

    public function revokeForTenant(string $tenantId): int
    {
        return PersonalAccessToken::where('tenant_id', $tenantId)->delete();
    }

    public function revokeForMembership(string $membershipId): int
    {
        return PersonalAccessToken::where('membership_id', $membershipId)->delete();
    }

    public function revokeForUser(User $user, ?int $exceptTokenId = null): int
    {
        return $user->tokens()->when($exceptTokenId, fn ($q) => $q->where('id', '!=', $exceptTokenId))->delete();
    }
}

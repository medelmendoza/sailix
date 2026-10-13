<?php

namespace App\Identity;

use App\Models\User;
use Illuminate\Support\Facades\DB;

/** Ends browser sessions of a user (database session driver). No-op for drivers without a user_id column. */
final class SessionRevoker
{
    public function revokeForUser(User $user, ?string $exceptSessionId = null): int
    {
        if (config('session.driver') !== 'database') {
            return 0;
        }

        return DB::table(config('session.table', 'sessions'))
            ->where('user_id', $user->getKey())
            ->when($exceptSessionId, fn ($q) => $q->where('id', '!=', $exceptSessionId))
            ->delete();
    }
}

<?php

namespace App\Identity;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/** Short-lived single-use ticket that carries a verified login across the membership-selection step. */
final class LoginTickets
{
    /** @param list<string> $membershipIds */
    public function issue(string $userId, array $membershipIds, string $channel): string
    {
        $ticket = Str::random(48);
        Cache::put($this->key($ticket), [
            'user_id' => $userId,
            'membership_ids' => $membershipIds,
            'channel' => $channel,
        ], config('sailix.ticket_ttl'));

        return $ticket;
    }

    /** @return array{user_id: string, membership_ids: list<string>, channel: string}|null */
    public function consume(string $ticket, string $channel): ?array
    {
        $payload = Cache::pull($this->key($ticket));

        return is_array($payload) && $payload['channel'] === $channel ? $payload : null;
    }

    private function key(string $ticket): string
    {
        return 'g:login-ticket:'.hash('sha256', $ticket);
    }
}

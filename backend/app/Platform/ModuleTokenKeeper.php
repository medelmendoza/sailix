<?php

namespace App\Platform;

use App\Enums\LinkStatus;
use App\Models\Tenant;
use App\Support\Audit;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

/**
 * Operator tooling for the encrypted external-account tokens (module_links). Platform-level by nature:
 * it works across organizations, so it lives here with the other cross-tenant operations. Never prints a token.
 */
final class ModuleTokenKeeper
{
    /**
     * Re-encrypts every stored token with the CURRENT app key (key rotation step 2, see docs/14).
     * Tokens written under a key listed in APP_PREVIOUS_KEYS are readable and are re-written under the new key.
     *
     * @return array{reencrypted: int, unreadable: int}
     */
    public function reencrypt(bool $invalidateUnreadable = false): array
    {
        $done = 0;
        $unreadable = 0;

        DB::table('module_links')->where(fn ($q) => $q->whereNotNull('access_token')->orWhereNotNull('refresh_token'))->orderBy('id')
            ->each(function (object $row) use (&$done, &$unreadable, $invalidateUnreadable) {
                try {
                    $update = [];
                    foreach (['access_token', 'refresh_token'] as $column) {
                        $update[$column] = $row->{$column} === null ? null : Crypt::encryptString(Crypt::decryptString($row->{$column}));
                    }
                    DB::table('module_links')->where('id', $row->id)->update($update);
                    $done++;
                } catch (DecryptException) {
                    $unreadable++; // written under a key that is no longer configured
                    if ($invalidateUnreadable) {
                        $this->wipeRows(DB::table('module_links')->where('id', $row->id));
                    }
                }
            });

        Audit::record('platform.module_tokens_reencrypted', null, null, ['reencrypted' => $done, 'unreadable' => $unreadable, 'invalidated' => $invalidateUnreadable ? $unreadable : 0]);

        return ['reencrypted' => $done, 'unreadable' => $unreadable];
    }

    /**
     * Incident response: forget every stored token (of one organization, or of all) and require users to link again.
     * This does NOT revoke them at the external service (Tala has no known revocation endpoint).
     */
    public function wipe(?string $tenantCode = null): int
    {
        $query = DB::table('module_links');
        if ($tenantCode !== null) {
            $tenantId = Tenant::where('code', strtoupper($tenantCode))->value('id');
            $query->where('tenant_id', $tenantId ?? '');
        }
        $count = $this->wipeRows($query);
        Audit::record('platform.module_tokens_wiped', null, null, ['scope' => $tenantCode === null ? 'all' : strtoupper($tenantCode), 'links' => $count]);

        return $count;
    }

    private function wipeRows(Builder $query): int
    {
        return $query->update(['access_token' => null, 'refresh_token' => null, 'token_expires_at' => null, 'status' => LinkStatus::NeedsRelink->value]);
    }
}

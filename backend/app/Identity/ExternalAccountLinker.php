<?php

namespace App\Identity;

use App\Models\ExternalIdentity;
use App\Models\ModuleLink;
use App\Models\User;
use App\Modules\Module;
use App\Support\ApiProblem;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/**
 * Identity-level ownership of external accounts (ADR-0017). One of the places allowed to look across tenants:
 * "is this Tala account already claimed by someone, in any organization?" cannot be answered inside one tenant.
 */
final class ExternalAccountLinker
{
    /**
     * Binds the external account to the user, or confirms an existing binding.
     * One external account belongs to one Sailix user ever; one user links one external account per module.
     */
    public function claim(User $user, Module $module, string $externalUserId): ExternalIdentity
    {
        try {
            return DB::transaction(function () use ($user, $module, $externalUserId) {
                $byAccount = ExternalIdentity::where('module', $module->value)->where('external_user_id', $externalUserId)->lockForUpdate()->first();
                if ($byAccount !== null && $byAccount->user_id !== $user->getKey()) {
                    throw ApiProblem::conflict('external_account_taken', 'This account is already linked to another Sailix user.');
                }
                $byUser = ExternalIdentity::where('module', $module->value)->where('user_id', $user->getKey())->lockForUpdate()->first();
                if ($byUser !== null && $byUser->external_user_id !== $externalUserId) {
                    throw ApiProblem::conflict('different_account_linked', 'You have already linked a different account. Unlink it first.');
                }

                return $byUser ?? $byAccount ?? tap(new ExternalIdentity, function (ExternalIdentity $i) use ($user, $module, $externalUserId) {
                    $i->forceFill(['user_id' => $user->getKey(), 'module' => $module->value, 'external_user_id' => $externalUserId])->save();
                });
            });
        } catch (UniqueConstraintViolationException) {
            throw ApiProblem::conflict('external_account_taken', 'This account is already linked to another Sailix user.');
        }
    }

    /** Deletes the link; drops the identity binding when no organization uses it any more. */
    public function release(ModuleLink $link): void
    {
        DB::transaction(function () use ($link) {
            $identityId = $link->external_identity_id;
            $link->delete();
            if (ModuleLink::withoutTenantScope()->where('external_identity_id', $identityId)->doesntExist()) {
                ExternalIdentity::whereKey($identityId)->delete();
            }
        });
    }
}

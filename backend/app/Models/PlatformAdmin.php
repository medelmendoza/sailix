<?php

namespace App\Models;

use App\Enums\UserStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Support\Carbon;

/** Superadmin identity: separate table, separate guard, mandatory TOTP (docs/04). */
/**
 * @property string $id
 * @property string $name
 * @property string $email
 * @property string|null $totp_secret
 * @property int|null $totp_last_step
 * @property UserStatus $status
 * @property Carbon|null $totp_confirmed_at
 */
#[Fillable(['name', 'email', 'password'])]
#[Hidden(['password', 'remember_token', 'totp_secret'])]
class PlatformAdmin extends Authenticatable
{
    use HasUuids;

    protected function casts(): array
    {
        return [
            'status' => UserStatus::class,
            'password' => 'hashed',
            'totp_secret' => 'encrypted',
            'totp_confirmed_at' => 'datetime',
            'last_login_at' => 'datetime',
        ];
    }

    public function isActive(): bool
    {
        return $this->status === UserStatus::Active;
    }
}

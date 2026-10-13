<?php

namespace App\Models;

use App\Enums\UserStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\HasApiTokens;

/** Login identity only (docs/02 §4). Roles live on memberships, never here. */
/**
 * @property string $id
 * @property string $username
 * @property string $email
 * @property string|null $display_name
 * @property string $password
 * @property UserStatus $status
 * @property Carbon|null $email_verified_at
 * @property Carbon|null $last_login_at
 */
#[Fillable(['username', 'email', 'display_name', 'password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    use HasApiTokens, HasUuids;

    protected function casts(): array
    {
        return [
            'status' => UserStatus::class,
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function isActive(): bool
    {
        return $this->status === UserStatus::Active;
    }
}

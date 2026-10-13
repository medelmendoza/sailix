<?php

namespace App\Models;

use App\Support\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * A cash advance / loan being deducted from a member's pay.
 *
 * @property string $id
 * @property string $tenant_id
 * @property string $membership_id
 * @property string $code
 * @property string $description
 * @property Carbon|null $loan_date
 * @property string $loan_amount
 * @property string $deduct_amount
 * @property string $paid_amount
 * @property string $balance
 * @property bool $is_dollar
 * @property bool $is_stopped
 * @property bool $is_inactive
 * @property string|null $remarks
 */
class Loan extends Model
{
    use BelongsToTenant, HasUuids;

    protected $guarded = ['*'];

    protected function casts(): array
    {
        return [
            'loan_date' => 'date', 'start_of_deduction' => 'date',
            'is_dollar' => 'boolean', 'is_stopped' => 'boolean', 'is_scholar' => 'boolean', 'is_cadet' => 'boolean', 'is_inactive' => 'boolean',
        ];
    }
}

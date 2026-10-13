<?php

namespace App\Models;

use App\Support\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * One payslip of a member: regular allotment, special, or final pay. Money is stored as the server computed it.
 *
 * @property string $id
 * @property string $tenant_id
 * @property string $membership_id
 * @property string $kind
 * @property Carbon $pay_date
 * @property string $period_label
 * @property string $vessel_name
 * @property bool $is_dollar
 * @property string $net_amount
 * @property bool $is_hold
 */
class Payslip extends Model
{
    use BelongsToTenant, HasUuids;

    public const REGULAR = 'regular';

    public const SPECIAL = 'special';

    public const FINAL = 'final';

    protected $guarded = ['*'];

    protected function casts(): array
    {
        return [
            'pay_date' => 'date', 'depart_date' => 'date', 'payroll_date' => 'date',
            'is_dollar' => 'boolean', 'is_hold' => 'boolean',
            'account_number' => 'encrypted', // never stored or returned in the clear
        ];
    }

    /** @return HasMany<PayslipDeduction, $this> */
    public function deductions(): HasMany
    {
        return $this->hasMany(PayslipDeduction::class)->orderBy('position');
    }

    /** Only the last four characters of the bank account number ever leave the server (spec BR-49). */
    public function maskedAccount(): ?string
    {
        $number = $this->account_number;
        if (! is_string($number) || $number === '') {
            return null;
        }

        return '••••'.substr($number, -4);
    }
}

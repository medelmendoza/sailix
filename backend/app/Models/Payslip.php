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
 * @property Carbon|null $depart_date
 * @property Carbon|null $payroll_date
 * @property string|null $full_vessel_name
 * @property string|null $position
 * @property string|null $address
 * @property string|null $payee_name
 * @property string|null $bank_code
 * @property string|null $account_number
 * @property string|null $exchange_rate
 * @property string|null $pay_usd
 * @property string|null $pay_peso
 * @property string|null $adjustment
 * @property string|null $adjustment_detail
 * @property string|null $signon_adjustment
 * @property string|null $union_dues
 * @property string|null $bank_charges
 * @property string|null $withholding_tax
 * @property string|null $mpfee
 * @property string|null $sss_total
 * @property string|null $employee_sss
 * @property string|null $employee_philhealth
 * @property string|null $employee_pagibig
 * @property string|null $deductions_total
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

<?php

namespace App\Finance;

use App\Models\Membership;
use App\Models\Payslip;
use App\Models\PayslipDeduction;

/** Payslips from the payroll system. One row per payslip; the same member, kind, pay date and period label is the same payslip. */
final class PayslipImport extends CsvImport
{
    private const MONEY = '/^-?\d{1,12}(\.\d{1,2})?$/';

    private const MONEY_FIELDS = [
        'net_amount', 'pay_usd', 'pay_peso', 'adjustment', 'signon_adjustment', 'union_dues', 'bank_charges', 'withholding_tax',
        'mpfee', 'sss_total', 'employee_sss', 'employee_philhealth', 'employee_pagibig', 'deductions_total',
    ];

    public function columns(): array
    {
        return [
            'username', 'kind', 'pay_date', 'period_label', 'vessel_name', 'net_amount',
            'full_vessel_name', 'position', 'address', 'payee_name', 'bank_code', 'account_number', 'depart_date', 'payroll_date',
            'is_dollar', 'exchange_rate', 'pay_usd', 'pay_peso', 'adjustment', 'adjustment_detail', 'signon_adjustment', 'union_dues',
            'bank_charges', 'withholding_tax', 'mpfee', 'sss_total', 'employee_sss', 'employee_philhealth', 'employee_pagibig',
            'deductions_total', 'deductions', 'is_hold', 'allotment_type',
        ];
    }

    public function required(): array
    {
        return ['username', 'kind', 'pay_date', 'period_label', 'vessel_name', 'net_amount'];
    }

    public function example(): array
    {
        return [
            'username' => 'crew.sfai', 'kind' => 'regular', 'pay_date' => '2026-09-30', 'period_label' => 'September 2026',
            'vessel_name' => 'MV Pacific Dawn', 'net_amount' => '19000.00', 'position' => 'Able Seaman', 'bank_code' => 'BDO',
            'account_number' => '0012345678', 'is_dollar' => 'no', 'exchange_rate' => '56.1250', 'pay_usd' => '420.00',
            'pay_peso' => '23572.50', 'employee_sss' => '1350.00', 'deductions_total' => '1750.00',
            'deductions' => 'Cash advance (Medical)=1000.00|Cash advance (Tickets)=750.00', 'is_hold' => 'no',
        ];
    }

    protected function rules(): array
    {
        $rules = [
            'kind' => ['required', 'in:regular,special,final'],
            'pay_date' => ['required', 'date_format:Y-m-d'],
            'period_label' => ['required', 'string', 'max:60'],
            'vessel_name' => ['required', 'string', 'max:120'],
            'full_vessel_name' => ['nullable', 'string', 'max:160'],
            'position' => ['nullable', 'string', 'max:120'],
            'address' => ['nullable', 'string', 'max:255'],
            'payee_name' => ['nullable', 'string', 'max:160'],
            'bank_code' => ['nullable', 'string', 'max:20'],
            'account_number' => ['nullable', 'regex:/^[0-9A-Za-z -]{1,40}$/'],
            'depart_date' => ['nullable', 'date_format:Y-m-d'],
            'payroll_date' => ['nullable', 'date_format:Y-m-d'],
            'is_dollar' => ['nullable', 'regex:/^(yes|no|y|n|true|false|1|0)$/i'],
            'is_hold' => ['nullable', 'regex:/^(yes|no|y|n|true|false|1|0)$/i'],
            'exchange_rate' => ['nullable', 'regex:/^\d{1,8}(\.\d{1,4})?$/'],
            'adjustment_detail' => ['nullable', 'string', 'max:255'],
            'allotment_type' => ['nullable', 'string', 'max:40'],
            'deductions' => ['nullable', 'string', 'max:2000', function (string $attribute, mixed $value, \Closure $fail) {
                if ($value !== null && $this->deductions((string) $value) === null) {
                    $fail('The deductions must look like "Description=1000.00|Other description=250.50".');
                }
            }],
        ];
        foreach (self::MONEY_FIELDS as $field) {
            $rules[$field] = [$field === 'net_amount' ? 'required' : 'nullable', 'regex:'.self::MONEY];
        }

        return $rules;
    }

    protected function normalize(array $row): array
    {
        $data = ['kind' => $row['kind'], 'pay_date' => $row['pay_date'], 'period_label' => $row['period_label']];
        foreach (['vessel_name', 'full_vessel_name', 'position', 'address', 'payee_name', 'bank_code', 'account_number', 'depart_date',
            'payroll_date', 'exchange_rate', 'adjustment_detail', 'allotment_type', ...self::MONEY_FIELDS] as $field) {
            $data[$field] = $row[$field] ?? null;
        }
        $data['is_dollar'] = $this->bool($row['is_dollar'] ?? null);
        $data['is_hold'] = $this->bool($row['is_hold'] ?? null);
        $data['deductions'] = isset($row['deductions']) ? ($this->deductions($row['deductions']) ?? []) : [];

        return $data;
    }

    protected function wouldCreate(Membership $member, array $data): bool
    {
        return $this->find($member, $data) === null;
    }

    protected function store(Membership $member, array $data): bool
    {
        $existing = $this->find($member, $data);
        $payslip = $existing ?? (new Payslip)->forceFill(['membership_id' => $member->id]);

        $columns = $data;
        unset($columns['deductions']);
        $payslip->forceFill($columns)->save(); // tenant_id is stamped from the context

        PayslipDeduction::where('payslip_id', $payslip->id)->get()->each->delete(); // the file is the truth for its deductions
        foreach ($data['deductions'] as $position => [$description, $amount]) {
            (new PayslipDeduction)->forceFill(['payslip_id' => $payslip->id, 'description' => $description, 'amount' => $amount, 'position' => $position])->save();
        }

        return $existing === null;
    }

    /** @param  array<string, mixed>  $data */
    private function find(Membership $member, array $data): ?Payslip
    {
        return Payslip::where('membership_id', $member->id)->where('kind', $data['kind'])
            ->whereDate('pay_date', $data['pay_date'])->where('period_label', $data['period_label'])->first();
    }

    /**
     * "Description=amount|Description=amount" to [[description, amount], ...]; null when it is not in that shape.
     *
     * @return list<array{0: string, 1: string}>|null
     */
    private function deductions(string $text): ?array
    {
        $out = [];
        foreach (explode('|', $text) as $part) {
            $pos = strrpos($part, '=');
            if ($pos === false) {
                return null;
            }
            $description = trim(substr($part, 0, $pos));
            $amount = trim(substr($part, $pos + 1));
            if ($description === '' || mb_strlen($description) > 150 || ! preg_match(self::MONEY, $amount)) {
                return null;
            }
            $out[] = [$description, $amount];
        }

        return count($out) > 40 ? null : $out;
    }
}

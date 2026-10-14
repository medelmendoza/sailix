<?php

namespace App\Finance;

use App\Models\Loan;
use App\Models\Membership;

/** Cash advances from the payroll system. One row per loan; the same member and loan code is the same loan. */
final class LoanImport extends CsvImport
{
    private const MONEY = '/^-?\d{1,12}(\.\d{1,2})?$/';

    public function columns(): array
    {
        return [
            'username', 'code', 'description', 'loan_amount', 'paid_amount', 'balance',
            'deduct_amount', 'loan_date', 'start_of_deduction', 'is_dollar', 'is_stopped', 'is_scholar', 'is_cadet', 'is_inactive', 'remarks',
        ];
    }

    public function required(): array
    {
        return ['username', 'code', 'description', 'loan_amount', 'paid_amount', 'balance'];
    }

    public function example(): array
    {
        return [
            'username' => 'crew.sfai', 'code' => 'MED', 'description' => 'Medical cash advance', 'loan_amount' => '10000.00',
            'paid_amount' => '4000.00', 'balance' => '6000.00', 'deduct_amount' => '1000.00', 'loan_date' => '2026-03-01',
            'start_of_deduction' => '2026-04-01', 'is_dollar' => 'no', 'is_stopped' => 'no',
        ];
    }

    protected function rules(): array
    {
        $bool = ['nullable', 'regex:/^(yes|no|y|n|true|false|1|0)$/i'];

        return [
            'code' => ['required', 'string', 'max:30'],
            'description' => ['required', 'string', 'max:150'],
            'loan_amount' => ['required', 'regex:'.self::MONEY],
            'paid_amount' => ['required', 'regex:'.self::MONEY],
            'balance' => ['required', 'regex:'.self::MONEY],
            'deduct_amount' => ['nullable', 'regex:'.self::MONEY],
            'loan_date' => ['nullable', 'date_format:Y-m-d'],
            'start_of_deduction' => ['nullable', 'date_format:Y-m-d'],
            'is_dollar' => $bool,
            'is_stopped' => $bool,
            'is_scholar' => $bool,
            'is_cadet' => $bool,
            'is_inactive' => $bool,
            'remarks' => ['nullable', 'string', 'max:255'],
        ];
    }

    protected function normalize(array $row): array
    {
        return [
            'code' => $row['code'], 'description' => $row['description'], 'loan_amount' => $row['loan_amount'],
            'paid_amount' => $row['paid_amount'], 'balance' => $row['balance'], 'deduct_amount' => $row['deduct_amount'] ?? '0.00',
            'loan_date' => $row['loan_date'] ?? null, 'start_of_deduction' => $row['start_of_deduction'] ?? null,
            'is_dollar' => $this->bool($row['is_dollar'] ?? null), 'is_stopped' => $this->bool($row['is_stopped'] ?? null),
            'is_scholar' => $this->bool($row['is_scholar'] ?? null), 'is_cadet' => $this->bool($row['is_cadet'] ?? null),
            'is_inactive' => $this->bool($row['is_inactive'] ?? null), 'remarks' => $row['remarks'] ?? null,
        ];
    }

    protected function wouldCreate(Membership $member, array $data): bool
    {
        return Loan::where('membership_id', $member->id)->where('code', $data['code'])->doesntExist();
    }

    protected function store(Membership $member, array $data): bool
    {
        $existing = Loan::where('membership_id', $member->id)->where('code', $data['code'])->first();
        ($existing ?? (new Loan)->forceFill(['membership_id' => $member->id]))->forceFill($data)->save(); // tenant_id is stamped from the context

        return $existing === null;
    }
}

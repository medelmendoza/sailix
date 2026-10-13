<?php

namespace App\Http\Controllers\Api\V1\Me;

use App\Http\Controllers\Controller;
use App\Models\Loan;
use App\Models\Payslip;
use App\Support\ApiProblem;
use App\Support\Audit;
use App\Support\FinanceStepUp;
use App\Support\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/**
 * A member's own payslips and cash advances. Every figure is the server's own value: nothing here is recomputed by a
 * client, and "own" is always the session's membership. Payslips need the step-up (password re-entry); cash advances do not.
 */
class FinanceController extends Controller
{
    public function status(Request $request): JsonResponse
    {
        return response()->json(['data' => [
            'step_up' => FinanceStepUp::required() ? 'password' : 'none',
            'unlocked' => FinanceStepUp::unlocked($request),
            'unlock_seconds' => FinanceStepUp::ttl(),
        ]]);
    }

    public function unlock(Request $request, TenantContext $context): JsonResponse
    {
        $data = $request->validate(['password' => ['required', 'string', 'max:1024']]);
        $user = $request->user();

        if (! Hash::check($data['password'], (string) $user->getAuthPassword())) {
            Audit::record('finance.unlock_failed', $context->tenantId(), null);
            throw ApiProblem::invalid('invalid_password', 'That password is not correct.');
        }
        FinanceStepUp::unlock($request);
        Audit::record('finance.unlocked', $context->tenantId(), null);

        return $this->status($request);
    }

    public function payslips(Request $request, TenantContext $context): JsonResponse
    {
        $this->guard($request);

        // allotment = regular + special together (as the old Allotment list); final = final pay
        $kinds = match ($request->input('kind')) {
            'final' => [Payslip::FINAL],
            'regular' => [Payslip::REGULAR],
            'special' => [Payslip::SPECIAL],
            default => [Payslip::REGULAR, Payslip::SPECIAL],
        };
        $rows = Payslip::where('membership_id', $context->membershipId())->where('is_hold', false)
            ->whereIn('kind', $kinds)->orderByDesc('pay_date')->orderBy('id')->get();

        return response()->json(['data' => $rows->map(fn (Payslip $p) => [
            'id' => $p->id,
            'kind' => $p->kind,
            'pay_date' => $p->pay_date->format('Y-m-d'),
            'period_label' => $p->period_label,
            'vessel_name' => $p->vessel_name,
            'net_amount' => $p->net_amount,
            'is_dollar' => $p->is_dollar,
        ])->all()]);
    }

    public function payslip(Request $request, string $payslip, TenantContext $context): JsonResponse
    {
        $this->guard($request);
        if (! preg_match('/^[0-9a-f-]{36}$/i', $payslip)) {
            throw ApiProblem::notFound('Payslip not found.');
        }
        $p = Payslip::with('deductions')->where('membership_id', $context->membershipId())->where('is_hold', false)->whereKey($payslip)->first()
            ?? throw ApiProblem::notFound('Payslip not found.'); // someone else's looks the same as a missing one

        $deductions = $p->deductions->map(fn ($d) => ['description' => $d->description, 'amount' => $d->amount])->all();

        return response()->json(['data' => [
            'id' => $p->id,
            'kind' => $p->kind,
            'pay_date' => $p->pay_date->format('Y-m-d'),
            'period_label' => $p->period_label,
            'vessel_name' => $p->vessel_name,
            'full_vessel_name' => $p->full_vessel_name,
            'position' => $p->position,
            'address' => $p->address,
            'depart_date' => $p->depart_date?->format('Y-m-d'),
            'payroll_date' => $p->payroll_date?->format('Y-m-d'),
            'payee_name' => $p->payee_name,
            'bank_code' => $p->bank_code,
            'account_number' => $p->maskedAccount(),
            'is_dollar' => $p->is_dollar,
            'exchange_rate' => $p->exchange_rate,
            'pay_usd' => $p->pay_usd,
            'pay_peso' => $p->pay_peso,
            'adjustment' => $p->adjustment,
            'adjustment_detail' => $p->adjustment_detail,
            'signon_adjustment' => $p->signon_adjustment,
            'union_dues' => $p->union_dues,
            'bank_charges' => $p->bank_charges,
            'withholding_tax' => $p->withholding_tax,
            'mpfee' => $p->mpfee,
            'sss_total' => $p->sss_total,
            'employee_sss' => $p->employee_sss,
            'employee_philhealth' => $p->employee_philhealth,
            'employee_pagibig' => $p->employee_pagibig,
            'deductions' => $deductions,
            'deductions_total' => $p->deductions_total,
            'net_amount' => $p->net_amount,
        ]]);
    }

    public function loans(TenantContext $context): JsonResponse
    {
        $loans = Loan::where('membership_id', $context->membershipId())->where('is_inactive', false)
            ->orderByDesc('loan_date')->orderBy('id')->get();

        // "Total deduction" = what is still being taken from pay each period, per currency (an assumption, docs/16)
        $running = $loans->filter(fn (Loan $l) => ! $l->is_stopped && (float) $l->balance > 0);
        $sum = fn (bool $dollar) => number_format((float) $running->where('is_dollar', $dollar)->sum(fn (Loan $l) => (float) $l->deduct_amount), 2, '.', '');

        return response()->json([
            'data' => $loans->map(fn (Loan $l) => [
                'id' => $l->id,
                'code' => $l->code,
                'description' => $l->description,
                'loan_date' => $l->loan_date?->format('Y-m-d'),
                'start_of_deduction' => $l->start_of_deduction?->format('Y-m-d'),
                'loan_amount' => $l->loan_amount,
                'deduct_amount' => $l->deduct_amount,
                'paid_amount' => $l->paid_amount,
                'balance' => $l->balance,
                'is_dollar' => $l->is_dollar,
                'is_stopped' => $l->is_stopped,
                'remarks' => $l->remarks,
            ])->all(),
            'totals' => ['php' => $sum(false), 'usd' => $sum(true)],
        ]);
    }

    private function guard(Request $request): void
    {
        if (! FinanceStepUp::unlocked($request)) {
            throw new ApiProblem(403, 'step_up_required', 'Enter your password to open your payslips.');
        }
    }
}

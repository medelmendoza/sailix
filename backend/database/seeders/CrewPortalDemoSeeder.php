<?php

namespace Database\Seeders;

use App\Enums\ModuleStatus;
use App\Enums\Role;
use App\Models\CallItReport;
use App\Models\CrewDocument;
use App\Models\DocumentType;
use App\Models\Loan;
use App\Models\Membership;
use App\Models\Payslip;
use App\Models\PayslipDeduction;
use App\Models\Tenant;
use App\Models\TenantModule;
use App\Modules\Module;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/**
 * LOCAL DEVELOPMENT ONLY: invented documents, payslips and cash advances for the demo crew members, so the Files and
 * Finance screens have something real-looking to show. Every name, number and amount is made up. Re-running replaces
 * the demo rows. Refuses to run outside local/testing.
 */
class CrewPortalDemoSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            $this->command?->error('The demo data only seeds in local/testing environments.');

            return;
        }

        foreach (Tenant::query()->whereIn('code', ['SFAI', 'ACME'])->get() as $tenant) {
            $this->astra($tenant);
            $types = $this->types($tenant);
            foreach (Membership::withoutTenantScope()->where('tenant_id', $tenant->id)->where('role', Role::Crew)->get() as $member) {
                $this->documents($tenant, $member, $types);
                $this->payslips($tenant, $member);
                $this->loans($tenant, $member);
                $this->reports($tenant, $member);
            }
        }
    }

    /** Astra and Call-it are built into the app: the demo organizations simply have them switched on. */
    private function astra(Tenant $tenant): void
    {
        foreach ([Module::Astra, Module::CallIt] as $module) {
            $row = TenantModule::withoutTenantScope()->where('tenant_id', $tenant->id)->where('module', $module->value)->first()
                ?? (new TenantModule)->forceFill(['tenant_id' => $tenant->id, 'module' => $module]);
            $row->forceFill(['status' => ModuleStatus::Enabled])->save();
        }
    }

    private function reports(Tenant $tenant, Membership $member): void
    {
        CallItReport::withoutTenantScope()->where('membership_id', $member->id)->get()->each->delete();

        foreach ([
            ['unsafe_conditions', 'equipment', 'main_deck', null, 'Oil leak under the starboard winch, floor slippery.', false, null, 'draft'],
            ['unsafe_acts', 'people', 'machinery_space', null, 'Saw a crew member working near the rotating shaft without a guard.', true, 'Stopped the work and called the duty engineer.', 'submitted'],
            ['unsafe_behaviour', 'processes', 'others', 'Gangway', 'Gangway net was not rigged during cargo operations.', false, null, 'reviewed'],
        ] as [$class, $sub, $loc, $other, $details, $intervened, $how, $status]) {
            (new CallItReport)->forceFill([
                'tenant_id' => $tenant->id, 'membership_id' => $member->id, 'classification' => $class, 'sub_classification' => $sub,
                'location' => $loc, 'location_other' => $other, 'vessel' => 'MV Pacific Dawn', 'details' => $details,
                'intervened' => $intervened, 'intervention_details' => $how, 'status' => $status,
                'submitted_at' => $status === 'draft' ? null : now()->subDays(3), 'reviewed_at' => $status === 'reviewed' ? now()->subDay() : null,
            ])->save();
        }
    }

    /** @return array<string, DocumentType> by short name */
    private function types(Tenant $tenant): array
    {
        $out = [];
        foreach ([
            'Passport' => 'PASSPORT', "Seaman's Book" => 'SIRB', 'Medical Certificate' => 'MEDICAL',
            'Basic Safety Training' => 'BST', 'Yellow Fever Vaccination' => 'YF', 'Certificate of Competency' => 'COC',
        ] as $name => $short) {
            $type = DocumentType::withoutTenantScope()->where('tenant_id', $tenant->id)->where('name', $name)->first()
                ?? (new DocumentType)->forceFill(['tenant_id' => $tenant->id, 'name' => $name]);
            $type->forceFill(['short_name' => $short, 'is_active' => true])->save();
            $out[$short] = $type;
        }

        return $out;
    }

    /** @param array<string, DocumentType> $types */
    private function documents(Tenant $tenant, Membership $member, array $types): void
    {
        CrewDocument::withoutTenantScope()->where('membership_id', $member->id)->get()->each(function (CrewDocument $d) {
            Storage::disk($d->file_disk)->delete($d->file_path);
            $d->delete();
        });

        $today = Carbon::today();
        $rows = [
            // [type, number, grade, place, school, issued, expires, status, rejection reason]
            ['PASSPORT', 'P1234567A', null, 'DFA Manila', null, $today->copy()->subYears(3), $today->copy()->addYears(7), 'approved', null],
            ['SIRB', 'SIRB-884213', null, 'MARINA', null, $today->copy()->subYears(2), $today->copy()->addMonths(2), 'approved', null],
            ['MEDICAL', 'PEME-2025-0412', 'Fit for sea duty', 'St. Luke’s Clinic', null, $today->copy()->subYear()->subMonths(2), $today->copy()->subDays(12), 'approved', null],
            ['BST', 'BST-77120', null, 'Manila', 'PMMA Training Center', $today->copy()->subYears(1), $today->copy()->addYears(4), 'approved', null],
            ['YF', 'YF-0099', null, 'Quarantine Bureau', null, $today->copy()->subMonths(8), null, 'pending', null],
            ['COC', 'COC-55231', 'Officer in Charge of a Navigational Watch', 'MARINA', 'PMMA', $today->copy()->subYears(1), $today->copy()->addYears(4), 'rejected', 'The scan is cut off at the bottom. Please upload the whole page.'],
        ];
        foreach ($rows as [$short, $number, $grade, $place, $school, $issued, $expires, $status, $reason]) {
            $path = "documents/{$tenant->id}/demo-".bin2hex(random_bytes(8)).'.pdf';
            $disk = (string) config('sailix.documents.disk', 'local');
            Storage::disk($disk)->put($path, self::pdf("{$types[$short]->name} - {$number}"));
            $d = (new CrewDocument)->forceFill([
                'tenant_id' => $tenant->id, 'membership_id' => $member->id, 'document_type_id' => $types[$short]->id,
                'number' => $number, 'grade' => $grade, 'location' => $place, 'school' => $school,
                'issued_on' => $issued, 'expires_on' => $expires, 'status' => $status, 'rejection_reason' => $reason,
                'reviewed_at' => $status === 'pending' ? null : now()->subDays(20), 'file_disk' => $disk, 'file_path' => $path,
                'file_original_name' => strtolower($short).'.pdf', 'file_mime' => 'application/pdf',
                'file_size' => strlen(self::pdf('x')), 'submitted_at' => now()->subDays(30),
            ]);
            $d->save();
        }
    }

    private function payslips(Tenant $tenant, Membership $member): void
    {
        Payslip::withoutTenantScope()->where('membership_id', $member->id)->get()->each->delete();

        $base = ['tenant_id' => $tenant->id, 'membership_id' => $member->id, 'vessel_name' => 'MV Pacific Dawn', 'full_vessel_name' => 'MV Pacific Dawn (Bulk Carrier)',
            'position' => 'Able Seaman', 'address' => '12 Harbor St., Manila', 'payee_name' => 'Demo Crew Spouse', 'bank_code' => 'BDO',
            'account_number' => '0012345678', 'allotment_type' => 'Allotment'];

        // Six monthly regular allotments, newest first
        for ($i = 0; $i < 6; $i++) {
            $month = Carbon::today()->startOfMonth()->subMonths($i);
            $usd = 420.00;
            $rate = 56.1250 - $i * 0.15;
            $peso = round($usd * $rate, 2);
            $sss = 1350.00;
            $phil = 450.00;
            $pagibig = 200.00;
            $union = 15.00;
            $bank = 5.00;
            $ded = [['Cash advance (Medical)', 1000.00], ['Cash advance (Tickets)', 750.00]];
            $dedTotal = array_sum(array_column($ded, 1));
            $net = round($peso - $sss - $phil - $pagibig - $union - $bank - $dedTotal, 2);
            $p = (new Payslip)->forceFill($base + [
                'kind' => 'regular', 'pay_date' => $month->copy()->endOfMonth(), 'period_label' => $month->format('F Y'),
                'depart_date' => $month->copy()->subMonths(4), 'payroll_date' => $month->copy()->endOfMonth()->subDays(2),
                'is_dollar' => false, 'exchange_rate' => $rate, 'pay_usd' => $usd, 'pay_peso' => $peso,
                'adjustment' => $i === 1 ? 35.00 : null, 'adjustment_detail' => $i === 1 ? 'Overtime adjustment' : null,
                'union_dues' => $union, 'bank_charges' => $bank, 'sss_total' => $sss + $phil + $pagibig,
                'employee_sss' => $sss, 'employee_philhealth' => $phil, 'employee_pagibig' => $pagibig,
                'deductions_total' => $dedTotal, 'net_amount' => $net,
            ]);
            $p->save();
            foreach ($ded as $n => [$text, $amount]) {
                (new PayslipDeduction)->forceFill(['tenant_id' => $tenant->id, 'payslip_id' => $p->id, 'description' => $text, 'amount' => $amount, 'position' => $n])->save();
            }
        }

        // Two special pays (one in dollars) and a final pay
        foreach ([[1, 'Christmas Bonus', false, 8500.00, null], [3, 'Special Allotment', true, null, 150.00]] as [$ago, $label, $dollar, $peso, $usd]) {
            (new Payslip)->forceFill($base + [
                'kind' => 'special', 'pay_date' => Carbon::today()->subMonths($ago)->startOfMonth()->addDays(14), 'period_label' => $label,
                'is_dollar' => $dollar, 'exchange_rate' => 56.0000, 'pay_usd' => $usd, 'pay_peso' => $peso,
                'bank_charges' => 5.00, 'net_amount' => $dollar ? 145.00 : 8495.00,
            ])->save();
        }
        $final = (new Payslip)->forceFill($base + [
            'kind' => 'final', 'pay_date' => Carbon::today()->subMonths(8)->endOfMonth(), 'period_label' => 'Final Pay',
            'depart_date' => Carbon::today()->subMonths(14), 'payroll_date' => Carbon::today()->subMonths(8)->endOfMonth(),
            'is_dollar' => false, 'exchange_rate' => 55.8000, 'pay_usd' => 1200.00, 'pay_peso' => 66960.00,
            'employee_sss' => 1350.00, 'employee_philhealth' => 450.00, 'employee_pagibig' => 200.00, 'sss_total' => 2000.00,
            'bank_charges' => 5.00, 'deductions_total' => 2500.00, 'net_amount' => 62455.00,
        ]);
        $final->save();
        foreach ([['Cash advance (Medical)', 1500.00], ['Uniform', 1000.00]] as $n => [$text, $amount]) {
            (new PayslipDeduction)->forceFill(['tenant_id' => $tenant->id, 'payslip_id' => $final->id, 'description' => $text, 'amount' => $amount, 'position' => $n])->save();
        }
        // A held payslip: the member must never see it
        (new Payslip)->forceFill($base + ['kind' => 'regular', 'pay_date' => Carbon::today()->addMonth()->endOfMonth(), 'period_label' => 'Held', 'is_hold' => true, 'net_amount' => 1.00])->save();
    }

    private function loans(Tenant $tenant, Membership $member): void
    {
        Loan::withoutTenantScope()->where('membership_id', $member->id)->get()->each->delete();

        foreach ([
            ['MED', 'Medical cash advance', 10000.00, 1000.00, 4000.00, false, false],
            ['TKT', 'Airfare advance', 18000.00, 750.00, 15000.00, false, false],
            ['USD1', 'Emergency advance (USD)', 500.00, 50.00, 500.00, true, false],
            ['OLD', 'Uniform advance (stopped)', 3000.00, 300.00, 1200.00, false, true],
        ] as [$code, $desc, $amount, $deduct, $paid, $dollar, $stopped]) {
            (new Loan)->forceFill([
                'tenant_id' => $tenant->id, 'membership_id' => $member->id, 'code' => $code, 'description' => $desc, 'loan_date' => Carbon::today()->subMonths(7),
                'start_of_deduction' => Carbon::today()->subMonths(6), 'loan_amount' => $amount, 'deduct_amount' => $deduct,
                'paid_amount' => $paid, 'balance' => $amount - $paid, 'is_dollar' => $dollar, 'is_stopped' => $stopped,
                'remarks' => $stopped ? 'Deduction stopped' : null,
            ])->save();
        }
    }

    /** A tiny valid one-page PDF with one line of text (no external tools needed). */
    public static function pdf(string $text): string
    {
        $text = addcslashes(preg_replace('/[^\x20-\x7e]/', '?', $text) ?? '', '()\\');
        $objects = [
            '<< /Type /Catalog /Pages 2 0 R >>',
            '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
            null,
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        ];
        $stream = "BT /F1 22 Tf 60 760 Tm (DEMO DOCUMENT) Tj ET\nBT /F1 14 Tf 60 720 Tm ({$text}) Tj ET\nBT /F1 10 Tf 60 690 Tm (Invented sample data for development.) Tj ET";
        $objects[3] = '<< /Length '.strlen($stream)." >>\nstream\n{$stream}\nendstream";

        $out = "%PDF-1.4\n";
        $offsets = [];
        foreach ($objects as $i => $body) {
            $offsets[$i] = strlen($out);
            $out .= ($i + 1)." 0 obj\n{$body}\nendobj\n";
        }
        $xref = strlen($out);
        $out .= "xref\n0 ".(count($objects) + 1)."\n0000000000 65535 f \n";
        foreach ($offsets as $off) {
            $out .= sprintf("%010d 00000 n \n", $off);
        }

        return $out."trailer\n<< /Size ".(count($objects) + 1)." /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF\n";
    }
}

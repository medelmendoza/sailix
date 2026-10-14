<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\AuditLog;
use App\Models\Loan;
use App\Models\Membership;
use App\Models\Payslip;
use App\Models\PayslipDeduction;
use App\Support\Tenancy\TenantContext;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class FinanceImportTest extends TestCase
{
    private const HEADER = 'username,kind,pay_date,period_label,vessel_name,net_amount,account_number,deductions,is_dollar';

    private function as(string $username): array
    {
        $this->app['auth']->forgetGuards();

        return $this->bearer($this->tokenFor($username));
    }

    private function setUpOrganizations(): void
    {
        foreach (['AAA' => ['adminA', 'crewA', 'crewA2'], 'BBB' => ['adminB', 'crewB']] as $code => $names) {
            $tenant = $this->makeTenant($code);
            foreach ($names as $name) {
                $this->makeMember($tenant, str_starts_with($name, 'admin') ? Role::TenantAdmin : Role::Crew, $name);
            }
        }
    }

    private function csv(string $content, string $name = 'payroll.csv'): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'csv');
        file_put_contents($path, $content);

        return new UploadedFile($path, $name, 'text/csv', null, true);
    }

    private function send(string $as, string $kind, string $content, bool $commit = false, string $name = 'payroll.csv')
    {
        return $this->post("/api/v1/tenant/finance/imports/$kind", ['file' => $this->csv($content, $name), 'commit' => $commit ? '1' : '0'], $this->as($as) + ['Accept' => 'application/json']);
    }

    private function payslipCsv(array $rows): string
    {
        return self::HEADER."\n".implode("\n", $rows)."\n";
    }

    public function test_a_check_run_reports_what_would_happen_and_writes_nothing(): void
    {
        $this->setUpOrganizations();
        $csv = $this->payslipCsv(['crewA,regular,2026-09-30,September 2026,MV Test,19000.00,0012345678,Medical=1000.00|Tickets=750.00,no', 'crewA2,final,2026-09-30,Final Pay,MV Test,5000.00,,,yes']);

        $r = $this->send('adminA', 'payslips', $csv)->assertOk()->json('data');
        $this->assertSame(['rows' => 2, 'created' => 2, 'updated' => 0, 'errors' => [], 'imported' => false], $r);
        $this->assertSame(0, Payslip::withoutTenantScope()->count());
    }

    public function test_committing_loads_the_payslips_with_their_deductions_for_the_right_members(): void
    {
        $this->setUpOrganizations();
        $csv = $this->payslipCsv(['crewA,regular,2026-09-30,September 2026,MV Test,19000.00,0012345678,Medical=1000.00|Tickets=750.00,no']);

        $r = $this->send('adminA', 'payslips', $csv, true)->assertOk()->json('data');
        $this->assertTrue($r['imported']);
        $this->assertSame(1, $r['created']);

        $p = Payslip::withoutTenantScope()->firstOrFail();
        $deductions = PayslipDeduction::withoutTenantScope()->where('payslip_id', $p->id)->orderBy('position')->get();
        $this->assertSame('19000.00', $p->net_amount);
        $this->assertFalse($p->is_dollar);
        $this->assertSame([['Medical', '1000.00'], ['Tickets', '750.00']], $deductions->map(fn ($d) => [$d->description, $d->amount])->all());
        $this->assertSame('crewA', Membership::withoutTenantScope()->with('user')->find($p->membership_id)->user->username);

        // the member sees it once they unlock, with the masked account
        $h = $this->as('crewA');
        $this->postJson('/api/v1/finance/unlock', ['password' => self::PASSWORD], $h)->assertOk();
        $this->getJson("/api/v1/payslips/{$p->id}", $h)->assertOk()->assertJsonPath('data.account_number', '••••5678')->assertJsonPath('data.deductions.0.description', 'Medical');
        $this->assertStringNotContainsString('0012345678', (string) DB::table('payslips')->where('id', $p->id)->value('account_number')); // encrypted at rest
    }

    public function test_loading_the_same_file_again_updates_instead_of_duplicating_and_replaces_the_deductions(): void
    {
        $this->setUpOrganizations();
        $this->send('adminA', 'payslips', $this->payslipCsv(['crewA,regular,2026-09-30,September 2026,MV Test,19000.00,,Medical=1000.00|Tickets=750.00,no']), true)->assertOk();
        $r = $this->send('adminA', 'payslips', $this->payslipCsv(['crewA,regular,2026-09-30,September 2026,MV Test,18500.00,,Medical=500.00,no']), true)->assertOk()->json('data');

        $this->assertSame(['created' => 0, 'updated' => 1], ['created' => $r['created'], 'updated' => $r['updated']]);
        $this->assertSame(1, Payslip::withoutTenantScope()->count());
        $this->assertSame('18500.00', Payslip::withoutTenantScope()->firstOrFail()->net_amount);
        $this->assertSame(1, PayslipDeduction::withoutTenantScope()->count());
    }

    public function test_one_bad_row_means_nothing_is_loaded_and_every_problem_is_listed_with_its_line(): void
    {
        $this->setUpOrganizations();
        $csv = $this->payslipCsv([
            'crewA,regular,2026-09-30,Good,MV Test,19000.00,,,no',          // line 2: fine
            'crewA,weekly,2026-09-30,Bad kind,MV Test,100.00,,,no',          // line 3
            'crewA,regular,30/09/2026,Bad date,MV Test,100.00,,,no',         // line 4
            'crewA,regular,2026-09-30,Bad money,MV Test,12,5,,,no',          // line 5 (extra comma shifts columns)
            'crewA,regular,2026-09-30,Bad deductions,MV Test,100.00,,nonsense,no', // line 6
            'ghost,regular,2026-09-30,Ghost,MV Test,100.00,,,no',            // line 7
        ]);

        $r = $this->send('adminA', 'payslips', $csv, true)->assertOk()->json('data');
        $this->assertFalse($r['imported']);
        $this->assertSame(0, Payslip::withoutTenantScope()->count()); // even the good row was not loaded
        $lines = array_column($r['errors'], 'line');
        foreach ([3, 4, 5, 6, 7] as $line) {
            $this->assertContains($line, $lines);
        }
        $this->assertNotContains(2, $lines);
        $this->assertStringContainsString('No member of your organization', collect($r['errors'])->firstWhere('line', 7)['message']);
    }

    public function test_a_username_of_another_organization_is_refused_and_nothing_crosses_over(): void
    {
        $this->setUpOrganizations();
        $r = $this->send('adminA', 'payslips', $this->payslipCsv(['crewB,regular,2026-09-30,Sept,MV Test,100.00,,,no']), true)->assertOk()->json('data');

        $this->assertFalse($r['imported']);
        $this->assertStringContainsString('No member of your organization', $r['errors'][0]['message']);
        $this->assertSame(0, Payslip::withoutTenantScope()->count());
    }

    public function test_columns_are_checked_unknown_and_missing_ones_stop_the_file(): void
    {
        $this->setUpOrganizations();

        $unknown = $this->send('adminA', 'payslips', "username,kind,pay_date,period_label,vessel_name,net_amount,salary\ncrewA,regular,2026-09-30,S,V,1.00,5\n", true)->assertOk()->json('data');
        $this->assertStringContainsString('Unknown column', $unknown['errors'][0]['message']);

        $missing = $this->send('adminA', 'payslips', "username,kind\ncrewA,regular\n", true)->assertOk()->json('data');
        $this->assertStringContainsString('Missing required', $missing['errors'][0]['message']);
        $this->assertSame(0, Payslip::withoutTenantScope()->count());
    }

    public function test_an_empty_file_a_wrong_extension_and_too_many_rows_are_refused(): void
    {
        $this->setUpOrganizations();

        $this->assertSame('The file is empty.', $this->send('adminA', 'payslips', '', true)->assertOk()->json('data.errors.0.message'));
        $this->send('adminA', 'payslips', self::HEADER."\n", true, 'payroll.exe')->assertStatus(422);

        $rows = array_fill(0, 2001, 'crewA,regular,2026-09-30,S,V,1.00,,,no');
        $r = $this->send('adminA', 'payslips', $this->payslipCsv($rows), true)->assertOk()->json('data');
        $this->assertStringContainsString('Too many rows', $r['errors'][0]['message']);
        $this->assertSame(0, Payslip::withoutTenantScope()->count());
    }

    public function test_a_byte_order_mark_and_blank_lines_are_fine_and_header_case_is_ignored(): void
    {
        $this->setUpOrganizations();
        $csv = "\xEF\xBB\xBFUsername,Kind,Pay_Date,Period_Label,Vessel_Name,Net_Amount\n\ncrewA,regular,2026-09-30,Sept,MV Test,100.50\n\n";

        $r = $this->send('adminA', 'payslips', $csv, true)->assertOk()->json('data');
        $this->assertTrue($r['imported']);
        $this->assertSame(1, $r['rows']);
    }

    public function test_loans_import_the_same_way_and_show_in_the_members_cash_advance(): void
    {
        $this->setUpOrganizations();
        $csv = "username,code,description,loan_amount,paid_amount,balance,deduct_amount,is_dollar,is_stopped\ncrewA,MED,Medical,10000.00,4000.00,6000.00,1000.00,no,no\ncrewA,USD1,Emergency,500.00,0.00,500.00,50.00,yes,no\n";

        $this->send('adminA', 'loans', $csv)->assertOk()->assertJsonPath('data.created', 2);
        $this->assertSame(0, Loan::withoutTenantScope()->count());
        $this->send('adminA', 'loans', $csv, true)->assertOk()->assertJsonPath('data.imported', true);

        $r = $this->getJson('/api/v1/loans', $this->as('crewA'))->assertOk();
        $this->assertEqualsCanonicalizing(['MED', 'USD1'], array_column($r->json('data'), 'code'));
        $this->assertSame(['php' => '1000.00', 'usd' => '50.00'], $r->json('totals'));

        // again: updated, not duplicated
        $this->send('adminA', 'loans', str_replace('4000.00,6000.00', '5000.00,5000.00', $csv), true)->assertOk()->assertJsonPath('data.updated', 2);
        $this->assertSame(2, Loan::withoutTenantScope()->count());
    }

    public function test_loans_need_their_server_amounts_and_validate_them(): void
    {
        $this->setUpOrganizations();
        $r = $this->send('adminA', 'loans', "username,code,description,loan_amount,paid_amount,balance\ncrewA,X,Thing,abc,0,0\n", true)->assertOk()->json('data');
        $this->assertFalse($r['imported']);
        $this->assertSame(2, $r['errors'][0]['line']);

        $this->send('adminA', 'loans', "username,code,description,loan_amount\ncrewA,X,Thing,100.00\n", true)->assertOk();
        $this->assertSame(0, Loan::withoutTenantScope()->count()); // balance is required: the server never works it out
    }

    public function test_the_template_is_a_csv_the_importer_accepts(): void
    {
        $this->setUpOrganizations();
        foreach (['payslips', 'loans'] as $kind) {
            $res = $this->get("/api/v1/tenant/finance/imports/$kind/template", $this->as('adminA'))->assertOk()->assertHeader('X-Content-Type-Options', 'nosniff');
            $this->assertStringStartsWith('username,', $res->getContent());
        }
        $this->get('/api/v1/tenant/finance/imports/other/template', $this->as('adminA'))->assertNotFound();
    }

    public function test_only_administrators_can_import_and_unauthenticated_requests_are_refused(): void
    {
        $this->setUpOrganizations();
        $this->send('crewA', 'payslips', self::HEADER."\n", true)->assertForbidden();
        $this->get('/api/v1/tenant/finance/imports/payslips/template', $this->as('crewA'))->assertForbidden();
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/tenant/finance/imports/payslips')->assertUnauthorized();
    }

    public function test_the_audit_trail_records_counts_only(): void
    {
        $this->setUpOrganizations();
        $this->send('adminA', 'payslips', $this->payslipCsv(['crewA,regular,2026-09-30,Sept,MV Test,12345.67,SECRETACCOUNT1,Hidden=1.00,no']), true)->assertOk();

        $log = AuditLog::query()->tap(fn () => app(TenantContext::class)->markPlatform())->where('action', 'finance.imported')->firstOrFail();
        $this->assertSame(['kind' => 'payslips', 'rows' => 1, 'created' => 1, 'updated' => 0], $log->metadata);
        $this->assertStringNotContainsString('12345', json_encode($log->toArray()));
        $this->assertStringNotContainsString('SECRETACCOUNT1', json_encode($log->toArray()));
    }
}

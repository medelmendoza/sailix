<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\AuditLog;
use App\Models\Loan;
use App\Models\Payslip;
use App\Models\PayslipDeduction;
use App\Models\Tenant;
use App\Support\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class FinanceTest extends TestCase
{
    /** @var array<string, string> */
    private array $m = [];

    private array $tenantId = [];

    private function as(string $username): array
    {
        $this->app['auth']->forgetGuards();

        return $this->bearer($this->tokenFor($username));
    }

    private function setUpOrganizations(): void
    {
        foreach (['AAA' => ['crewA', 'crewA2'], 'BBB' => ['crewB']] as $code => $names) {
            $tenant = $this->makeTenant($code);
            $this->tenantId[$code] = $tenant->id;
            foreach ($names as $name) {
                [, $membership] = $this->makeMember($tenant, Role::Crew, $name);
                $this->m[$name] = $membership->id;
            }
        }
    }

    private function payslip(string $owner, string $tenant, array $over = []): Payslip
    {
        $p = (new Payslip)->forceFill($over + [
            'tenant_id' => $this->tenantId[$tenant], 'membership_id' => $this->m[$owner], 'kind' => 'regular', 'pay_date' => '2026-09-30',
            'period_label' => 'September 2026', 'vessel_name' => 'MV Test', 'account_number' => '0012345678', 'is_dollar' => false,
            'pay_usd' => '420.00', 'pay_peso' => '23572.50', 'net_amount' => '19000.00', 'deductions_total' => '1750.00',
        ]);
        $p->save();
        (new PayslipDeduction)->forceFill(['tenant_id' => $this->tenantId[$tenant], 'payslip_id' => $p->id, 'description' => 'Cash advance', 'amount' => '1750.00', 'position' => 0])->save();

        return $p;
    }

    private function unlock(string $as, ?string $password = null): array
    {
        $headers = $this->as($as);
        $this->postJson('/api/v1/finance/unlock', ['password' => $password ?? self::PASSWORD], $headers)->assertOk();

        return $headers;
    }

    public function test_payslips_are_locked_until_the_password_is_entered_again(): void
    {
        $this->setUpOrganizations();
        $p = $this->payslip('crewA', 'AAA');
        $h = $this->as('crewA');

        $this->getJson('/api/v1/finance/status', $h)->assertOk()->assertJsonPath('data.unlocked', false)->assertJsonPath('data.step_up', 'password');
        $this->getJson('/api/v1/payslips', $h)->assertStatus(403)->assertJsonPath('code', 'step_up_required');
        $this->getJson("/api/v1/payslips/{$p->id}", $h)->assertStatus(403)->assertJsonPath('code', 'step_up_required');

        $this->postJson('/api/v1/finance/unlock', ['password' => 'wrong-password'], $h)->assertStatus(422)->assertJsonPath('code', 'invalid_password');
        $this->getJson('/api/v1/payslips', $h)->assertStatus(403);

        $this->postJson('/api/v1/finance/unlock', ['password' => self::PASSWORD], $h)->assertOk()->assertJsonPath('data.unlocked', true);
        $this->getJson('/api/v1/payslips', $h)->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_an_unlock_belongs_to_one_sign_in_only(): void
    {
        $this->setUpOrganizations();
        $this->payslip('crewA', 'AAA');
        $this->unlock('crewA');

        // a second sign-in (another device) of the same person starts locked
        $this->getJson('/api/v1/payslips', $this->as('crewA'))->assertStatus(403)->assertJsonPath('code', 'step_up_required');
    }

    public function test_the_unlock_expires(): void
    {
        $this->setUpOrganizations();
        $this->payslip('crewA', 'AAA');
        $h = $this->unlock('crewA');
        $this->getJson('/api/v1/payslips', $h)->assertOk();

        $this->travel(config('sailix.finance_unlock_ttl') + 5)->seconds();
        $this->getJson('/api/v1/payslips', $h)->assertStatus(403);
    }

    public function test_an_organization_can_switch_the_step_up_off_for_itself_only(): void
    {
        $this->setUpOrganizations();
        $this->makeMember(Tenant::findOrFail($this->tenantId['AAA']), Role::TenantAdmin, 'adminA');
        $this->payslip('crewA', 'AAA');
        $this->payslip('crewB', 'BBB');

        $this->patchJson('/api/v1/tenant', ['settings' => ['payslip_step_up' => 'none']], $this->as('adminA'))->assertOk();

        $this->getJson('/api/v1/payslips', $this->as('crewA'))->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/finance/status', $this->as('crewA'))->assertOk()->assertJsonPath('data.step_up', 'none');
        $this->getJson('/api/v1/payslips', $this->as('crewB'))->assertStatus(403); // the other organization is unaffected
    }

    public function test_the_password_is_rate_limited_and_never_audited(): void
    {
        $this->setUpOrganizations();
        $h = $this->as('crewA');
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/finance/unlock', ['password' => "guess-$i-secret"], $h)->assertStatus(422);
        }
        $this->postJson('/api/v1/finance/unlock', ['password' => 'guess-6-secret'], $h)->assertStatus(429);

        $logs = AuditLog::query()->tap(fn () => app(TenantContext::class)->markPlatform())->where('action', 'like', 'finance.%')->get();
        $this->assertSame(5, $logs->where('action', 'finance.unlock_failed')->count());
        $this->assertStringNotContainsString('secret', json_encode($logs->toArray()));
    }

    public function test_nobody_reads_someone_elses_payslip_and_held_payslips_are_hidden(): void
    {
        $this->setUpOrganizations();
        $mine = $this->payslip('crewA', 'AAA');
        $held = $this->payslip('crewA', 'AAA', ['is_hold' => true, 'period_label' => 'Held']);
        $theirs = $this->payslip('crewB', 'BBB');

        $h = $this->unlock('crewA');
        $this->getJson("/api/v1/payslips/{$mine->id}", $h)->assertOk();
        $this->getJson("/api/v1/payslips/{$held->id}", $h)->assertNotFound();
        $this->getJson("/api/v1/payslips/{$theirs->id}", $h)->assertNotFound();
        $this->getJson('/api/v1/payslips/not-an-id', $h)->assertNotFound();
        $this->assertSame([$mine->id], array_column($this->getJson('/api/v1/payslips', $h)->json('data'), 'id'));

        $this->getJson("/api/v1/payslips/{$mine->id}", $this->unlock('crewA2'))->assertNotFound(); // a colleague in the same organization
        $this->getJson('/api/v1/payslips')->assertUnauthorized();
    }

    public function test_the_bank_account_is_encrypted_at_rest_and_masked_in_every_response(): void
    {
        $this->setUpOrganizations();
        $p = $this->payslip('crewA', 'AAA');

        $raw = DB::table('payslips')->where('id', $p->id)->value('account_number');
        $this->assertStringNotContainsString('0012345678', (string) $raw);

        $h = $this->unlock('crewA');
        $body = $this->getJson("/api/v1/payslips/{$p->id}", $h)->assertOk()->assertJsonPath('data.account_number', '••••5678');
        $this->assertStringNotContainsString('0012345678', $body->getContent());
    }

    public function test_the_lists_split_allotment_and_final_and_sort_newest_first(): void
    {
        $this->setUpOrganizations();
        $this->payslip('crewA', 'AAA', ['kind' => 'regular', 'pay_date' => '2026-08-31', 'period_label' => 'August 2026']);
        $this->payslip('crewA', 'AAA', ['kind' => 'special', 'pay_date' => '2026-09-15', 'period_label' => 'Bonus']);
        $this->payslip('crewA', 'AAA', ['kind' => 'final', 'pay_date' => '2026-01-31', 'period_label' => 'Final Pay']);
        $h = $this->unlock('crewA');

        $allot = $this->getJson('/api/v1/payslips', $h)->json('data');
        $this->assertSame(['Bonus', 'August 2026'], array_column($allot, 'period_label'));
        $this->assertSame(['Final Pay'], array_column($this->getJson('/api/v1/payslips?kind=final', $h)->json('data'), 'period_label'));
    }

    public function test_money_comes_back_as_the_servers_decimal_strings_with_the_deductions(): void
    {
        $this->setUpOrganizations();
        $p = $this->payslip('crewA', 'AAA');
        $d = $this->getJson("/api/v1/payslips/{$p->id}", $this->unlock('crewA'))->assertOk()->json('data');

        $this->assertSame('19000.00', $d['net_amount']);
        $this->assertSame('420.00', $d['pay_usd']);
        $this->assertSame([['description' => 'Cash advance', 'amount' => '1750.00']], $d['deductions']);
        $this->assertSame('1750.00', $d['deductions_total']);
    }

    public function test_cash_advances_are_not_behind_the_step_up_and_totals_are_per_currency_of_running_loans(): void
    {
        $this->setUpOrganizations();
        $loan = fn (string $owner, string $tenant, array $o) => (new Loan)->forceFill($o + [
            'tenant_id' => $this->tenantId[$tenant], 'membership_id' => $this->m[$owner], 'code' => 'X', 'description' => 'd',
            'loan_amount' => '1000.00', 'deduct_amount' => '100.00', 'paid_amount' => '0.00', 'balance' => '1000.00',
        ])->save();
        $loan('crewA', 'AAA', ['code' => 'PHP1', 'deduct_amount' => '100.00']);
        $loan('crewA', 'AAA', ['code' => 'PHP2', 'deduct_amount' => '250.50']);
        $loan('crewA', 'AAA', ['code' => 'USD1', 'is_dollar' => true, 'deduct_amount' => '40.00']);
        $loan('crewA', 'AAA', ['code' => 'STOP', 'is_stopped' => true, 'deduct_amount' => '999.00']);
        $loan('crewA', 'AAA', ['code' => 'PAID', 'balance' => '0.00', 'deduct_amount' => '888.00']);
        $loan('crewA', 'AAA', ['code' => 'OLD', 'is_inactive' => true]);
        $loan('crewB', 'BBB', ['code' => 'OTHER']);

        $r = $this->getJson('/api/v1/loans', $this->as('crewA'))->assertOk();
        $this->assertEqualsCanonicalizing(['PHP1', 'PHP2', 'USD1', 'STOP', 'PAID'], array_column($r->json('data'), 'code')); // inactive and others' hidden
        $this->assertSame(['php' => '350.50', 'usd' => '40.00'], $r->json('totals'));
        $this->getJson('/api/v1/loans')->assertUnauthorized();
    }
}

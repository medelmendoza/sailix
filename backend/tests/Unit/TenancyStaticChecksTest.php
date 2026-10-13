<?php

namespace Tests\Unit;

use App\Support\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\MassAssignmentException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\Finder\Finder;
use Tests\TestCase;

/** Static guards for the tenancy rules in docs/03 §4 and CONTRIBUTING. */
class TenancyStaticChecksTest extends TestCase
{
    /** withoutTenantScope()/withoutGlobalScope(s) only in sanctioned namespaces. */
    public function test_scope_bypass_is_confined_to_platform_and_identity_code(): void
    {
        $allowed = ['app/Platform/', 'app/Identity/', 'app/Support/Tenancy/'];
        $offenders = [];

        foreach ((new Finder)->files()->name('*.php')->in(base_path('app')) as $file) {
            $rel = 'app/'.str_replace('\\', '/', $file->getRelativePathname());
            if (collect($allowed)->contains(fn ($dir) => str_starts_with($rel, $dir))) {
                continue;
            }
            if (preg_match('/withoutTenantScope\s*\(|withoutGlobalScopes?\s*\(/', $file->getContents())) {
                $offenders[] = $rel;
            }
        }

        $this->assertSame([], $offenders, 'Scope bypass outside app/Platform and app/Identity.');
    }

    /** Raw table access to tenant-owned tables bypasses the global scope. */
    public function test_no_raw_db_table_access_to_tenant_tables_outside_sanctioned_code(): void
    {
        $tenantTables = $this->tenantTables();
        $offenders = [];

        foreach ((new Finder)->files()->name('*.php')->in(base_path('app')) as $file) {
            $rel = 'app/'.str_replace('\\', '/', $file->getRelativePathname());
            if (str_starts_with($rel, 'app/Platform/') || str_starts_with($rel, 'app/Identity/')) {
                continue;
            }
            foreach ($tenantTables as $table) {
                if (preg_match('/DB::table\(\s*[\'"]'.preg_quote($table, '/').'[\'"]/', $file->getContents())) {
                    $offenders[] = "$rel → $table";
                }
            }
        }

        $this->assertSame([], $offenders);
    }

    /** Every tenant-owned table has a model that uses BelongsToTenant (auth infrastructure exempt). */
    public function test_every_table_with_tenant_id_has_a_scoped_model(): void
    {
        $exempt = ['personal_access_tokens', 'audit_logs']; // token: auth infra w/ composite FK; audit: AuditScope
        $modelTables = [];
        foreach ((new Finder)->files()->name('*.php')->in(base_path('app/Models')) as $file) {
            $class = 'App\\Models\\'.$file->getBasename('.php');
            $model = new $class;
            $modelTables[$model->getTable()] = in_array(BelongsToTenant::class, class_uses_recursive($class), true);
        }

        foreach ($this->tenantTables() as $table) {
            if (in_array($table, $exempt, true)) {
                continue;
            }
            $this->assertTrue($modelTables[$table] ?? false, "Table [$table] has tenant_id but no BelongsToTenant model.");
        }
    }

    /** Tenant-owned tables lead their indexes with tenant_id and tie to tenants by FK. */
    public function test_tenant_tables_have_tenant_foreign_key_and_tenant_leading_unique_keys(): void
    {
        foreach ($this->tenantTables() as $table) {
            if ($table === 'audit_logs') {
                continue; // append-only history deliberately has no FK so it outlives tenant state changes
            }
            $fks = collect(Schema::getForeignKeys($table));
            $this->assertTrue(
                $fks->contains(fn ($fk) => $fk['foreign_table'] === 'tenants' && $fk['columns'] === ['tenant_id'])
                || $fks->contains(fn ($fk) => in_array('tenant_id', $fk['columns'], true)),
                "Table [$table] has no foreign key on tenant_id.",
            );

            foreach (collect(Schema::getIndexes($table))->where('unique', true)->where('primary', false) as $index) {
                if (in_array('tenant_id', $index['columns'], true)) {
                    $this->assertSame('tenant_id', $index['columns'][0], "Unique index [{$index['name']}] on [$table] must lead with tenant_id.");
                }
            }
        }
    }

    public function test_tenant_owned_models_do_not_allow_mass_assigning_tenant_id(): void
    {
        foreach ((new Finder)->files()->name('*.php')->in(base_path('app/Models')) as $file) {
            $class = 'App\\Models\\'.$file->getBasename('.php');
            if (! in_array(BelongsToTenant::class, class_uses_recursive($class), true)) {
                continue;
            }
            $model = new $class;
            try {
                $model->fill(['tenant_id' => 'attacker']);
            } catch (MassAssignmentException) {
                continue; // fully guarded model: also safe
            }
            $this->assertNull($model->getAttribute('tenant_id'), "$class allows mass-assigning tenant_id.");
        }
    }

    /** @return list<string> */
    private function tenantTables(): array
    {
        return $this->currentTables()
            ->filter(fn ($t) => in_array('tenant_id', Schema::getColumnListing($t), true))
            ->reject(fn ($t) => $t === 'tenants')
            ->values()->all();
    }

    /**
     * Tables WITHOUT tenant_id are an explicit, reviewed set. Adding an un-scoped table must be a conscious
     * decision (extend this list with a justification), never an accident.
     */
    public function test_tables_without_tenant_id_are_a_known_reviewed_set(): void
    {
        $justified = [
            'tenants' => 'the organization itself',
            'users' => 'login identity; tenancy lives on memberships',
            'platform_admins' => 'superadmin identity, separate guard',
            'platform_settings' => 'platform-wide configuration',
            'external_identities' => 'identity-level link of a Sailix user to an external account; uniqueness must be global (ADR-0017)',
            'sessions' => 'framework session store',
            'cache' => 'framework cache store (keys are tenant-prefixed in code)',
            'cache_locks' => 'framework',
            'jobs' => 'framework queue (payload carries tenant context when jobs exist)',
            'job_batches' => 'framework',
            'failed_jobs' => 'framework',
            'migrations' => 'framework',
        ];

        $actual = $this->currentTables()
            ->reject(fn ($t) => in_array('tenant_id', Schema::getColumnListing($t), true))
            ->sort()->values()->all();

        $this->assertSame(collect(array_keys($justified))->sort()->values()->all(), $actual, 'Un-scoped table set changed: justify it in this test.');
    }

    public function test_module_tables_are_covered_by_the_scoped_model_rule(): void
    {
        $tables = $this->tenantTables();

        $this->assertContains('tenant_modules', $tables);
        $this->assertContains('module_links', $tables);
        $this->assertNotContains('external_identities', $tables, 'identity-level by design (ADR-0017)');
    }

    /**
     * Table names of THIS connection's database only (getTables() otherwise lists every schema the
     * MySQL user can see, e.g. the dev database next to the test database).
     *
     * @return Collection<int, string>
     */
    private function currentTables(): Collection
    {
        $database = DB::connection()->getDatabaseName();

        return collect(Schema::getTables())
            ->filter(fn ($t) => ! isset($t['schema']) || $t['schema'] === $database)
            ->pluck('name')->unique()->values();
    }
}

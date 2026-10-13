<?php

namespace Tests\Unit;

use App\Support\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\MassAssignmentException;
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
        return collect(Schema::getTables())
            ->pluck('name')
            ->filter(fn ($t) => in_array('tenant_id', Schema::getColumnListing($t), true))
            ->reject(fn ($t) => $t === 'tenants')
            ->values()->all();
    }
}

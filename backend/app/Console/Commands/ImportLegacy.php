<?php

namespace App\Console\Commands;

use App\Platform\LegacyImport\LegacyImporter;
use Illuminate\Console\Command;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class ImportLegacy extends Command
{
    protected $signature = 'legacy:import
        {--dry-run : Run everything, report, and undo it}
        {--files= : Folder holding the old uploaded files (by file name)}
        {--include-licenses : Also import every document kind marked as a licence, not only the kinds in use}
        {--tenant-code= : Organization code to import into (default: the old client_code)}
        {--same-database : The v2 tables were created in the same database as the old tables (the old tables stay as they are)}
        {--allow-writable-source : Do not refuse an old-database user that has write rights}';

    protected $description = 'Copies the old Sailix database (read only) into this v2 database. Re-runnable; see docs/18-LEGACY-IMPORT.md.';

    public function handle(): int
    {
        $importer = new LegacyImporter;
        try {
            if ($this->option('same-database')) {
                // the old tables are read through the app's own database connection
                config(['database.connections.legacy' => config('database.connections.'.config('database.default'))]);
                DB::purge('legacy');
            }
            $importer->guard((bool) $this->option('allow-writable-source'), (bool) $this->option('same-database'));
            $report = $importer->import(
                (bool) $this->option('dry-run'),
                $this->option('files') ?: null,
                (bool) $this->option('include-licenses'),
                $this->option('tenant-code') ?: null,
            );
        } catch (RuntimeException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        } catch (QueryException $e) {
            // The full message carries the SQL with the values being written (names, emails): print only what failed.
            $this->error('Database error, nothing was written: '.(strstr($e->getMessage(), ' (Connection', true) ?: 'see the log'));

            return self::FAILURE;
        }

        $this->table(['Entity', 'Created', 'Updated', 'Skipped'], collect($report->entities)->map(
            fn ($c, $name) => [$name, $c['created'], $c['updated'], $c['skipped']],
        )->values()->all());
        foreach ($report->notes as $note) {
            $this->line(' - '.$note);
        }

        return self::SUCCESS;
    }
}

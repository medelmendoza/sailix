<?php

namespace App\Console\Commands;

use App\Platform\ModuleTokenKeeper;
use Illuminate\Console\Command;

class WipeModuleTokens extends Command
{
    protected $signature = 'sailix:tokens:wipe {--tenant= : Organization code} {--all : Every organization} {--force : Skip the confirmation}';

    protected $description = 'Incident response: delete stored external-account tokens and require users to link again (does not revoke them at the external service).';

    public function handle(ModuleTokenKeeper $keeper): int
    {
        $tenant = $this->option('tenant');
        if (($tenant === null) === (! $this->option('all'))) {
            $this->error('Give exactly one of --tenant=CODE or --all.');

            return self::FAILURE;
        }
        if (! $this->option('force') && ! $this->confirm($tenant ? "Wipe all stored tokens of $tenant?" : 'Wipe ALL stored tokens of ALL organizations?')) {
            return self::FAILURE;
        }
        $this->info('Wiped '.$keeper->wipe(is_string($tenant) ? $tenant : null).' link(s).');

        return self::SUCCESS;
    }
}

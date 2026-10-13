<?php

namespace App\Console\Commands;

use App\Platform\ModuleTokenKeeper;
use Illuminate\Console\Command;

class ReencryptModuleTokens extends Command
{
    protected $signature = 'sailix:tokens:reencrypt {--invalidate-unreadable : Wipe links whose tokens cannot be decrypted with any configured key (users must link again)}';

    protected $description = 'Re-encrypt stored external-account tokens with the current APP_KEY (run after rotating the key; see docs/14).';

    public function handle(ModuleTokenKeeper $keeper): int
    {
        $r = $keeper->reencrypt((bool) $this->option('invalidate-unreadable'));
        $this->info("Re-encrypted {$r['reencrypted']} link(s).");
        if ($r['unreadable'] > 0) {
            $this->warn("{$r['unreadable']} link(s) could not be decrypted with any configured key.".($this->option('invalidate-unreadable') ? ' They were invalidated.' : ' Re-run with --invalidate-unreadable, or add the old key to APP_PREVIOUS_KEYS.'));

            return $this->option('invalidate-unreadable') ? self::SUCCESS : self::FAILURE;
        }

        return self::SUCCESS;
    }
}

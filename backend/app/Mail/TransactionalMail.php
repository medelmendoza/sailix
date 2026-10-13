<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Base of every transactional mail. Delivered by the queue worker (not in the request), retried with back-off,
 * and ENCRYPTED in the queue because bodies can carry single-use links (password reset, invitations).
 * A permanent failure is logged without recipient or content.
 */
abstract class TransactionalMail extends Mailable implements ShouldBeEncrypted, ShouldQueue
{
    use Queueable;

    public int $tries = 4;

    /** @return list<int> seconds between attempts */
    public function backoff(): array
    {
        return [30, 120, 600];
    }

    public function failed(Throwable $e): void
    {
        Log::error('transactional mail permanently failed', ['mailable' => class_basename($this), 'error' => class_basename($e)]);
    }
}

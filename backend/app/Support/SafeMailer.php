<?php

namespace App\Support;

use Illuminate\Mail\Mailable;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Queues transactional mail (delivered by `queue:work` through the configured driver MAIL_MAILER; provider undecided, D-11).
 * A queueing failure must never fail the API call or leak whether an account exists; it is logged
 * without the recipient address or message content.
 */
final class SafeMailer
{
    public static function send(string $to, Mailable $mailable): bool
    {
        try {
            Mail::to($to)->queue($mailable);

            return true;
        } catch (Throwable $e) {
            Log::warning('transactional mail delivery failed', ['mailable' => class_basename($mailable), 'error' => class_basename($e)]);

            return false;
        }
    }
}

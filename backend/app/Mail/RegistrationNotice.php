<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** Sent instead of creating a second account when someone registers with an email that already has one. */
class RegistrationNotice extends Mailable
{
    public function __construct(public string $resetUrl) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Sailix registration attempt');
    }

    public function content(): Content
    {
        return new Content(text: 'mail.registration-notice');
    }
}

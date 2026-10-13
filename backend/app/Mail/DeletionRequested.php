<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class DeletionRequested extends Mailable
{
    public function __construct(public string $organization) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: "Account deletion request in {$this->organization}");
    }

    public function content(): Content
    {
        return new Content(text: 'mail.deletion-requested');
    }
}

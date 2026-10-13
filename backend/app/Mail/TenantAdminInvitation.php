<?php

namespace App\Mail;

use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class TenantAdminInvitation extends TransactionalMail
{
    public function __construct(public string $tenantName, public string $acceptUrl) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: "You have been invited to administer {$this->tenantName}");
    }

    public function content(): Content
    {
        return new Content(text: 'mail.invitation');
    }
}

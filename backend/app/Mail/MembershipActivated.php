<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class MembershipActivated extends Mailable
{
    public function __construct(public string $organization) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: "Your Sailix account for {$this->organization} is active");
    }

    public function content(): Content
    {
        return new Content(text: 'mail.membership-activated');
    }
}

<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Mail\DeletionRequested;
use App\Mail\MembershipActivated;
use App\Mail\PasswordResetLink;
use App\Mail\RegistrationNotice;
use App\Mail\TenantAdminInvitation;
use Illuminate\Mail\Mailable;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * The bodies are plain text: values must appear verbatim. (HTML-escaping a URL turns `&` into `&amp;`
 * and breaks the emailed reset link, which unit tests on mailable properties cannot see.)
 */
class MailTemplatesTest extends TestCase
{
    private function text(Mailable $mailable): string
    {
        return (string) $mailable->render();
    }

    public function test_the_reset_link_is_rendered_verbatim(): void
    {
        $url = 'https://portal.example.test/reset-password?token=abc123&email=maria%40example.test';
        $body = $this->text(new PasswordResetLink($url));

        $this->assertStringContainsString($url, $body);
        $this->assertStringNotContainsString('&amp;', $body);
    }

    public function test_other_links_and_names_are_rendered_verbatim(): void
    {
        $this->assertStringContainsString('https://portal.example.test/forgot-password?a=1&b=2', $this->text(new RegistrationNotice('https://portal.example.test/forgot-password?a=1&b=2')));
        $this->assertStringContainsString('https://portal.example.test/accept-invitation?token=a%2Fb&x=1', $this->text(new TenantAdminInvitation('Acme & Sons', 'https://portal.example.test/accept-invitation?token=a%2Fb&x=1')));

        foreach ([new MembershipActivated("O'Brien & Co <crew>"), new DeletionRequested("O'Brien & Co <crew>")] as $mail) {
            $body = $this->text($mail);
            $this->assertStringContainsString("O'Brien & Co <crew>", $body);
            $this->assertStringNotContainsString('&amp;', $body);
            $this->assertStringNotContainsString('&#039;', $body);
        }
    }

    public function test_the_mail_that_is_actually_sent_for_a_reset_carries_a_usable_link(): void
    {
        Mail::fake();
        $this->makeMember($this->makeTenant('SFAI'), Role::Crew, 'crew1');

        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'crew1@example.test'])->assertStatus(202);

        $sent = Mail::queued(PasswordResetLink::class)->first();
        $body = $this->text($sent);
        $this->assertStringContainsString($sent->url, $body);
        parse_str((string) parse_url($sent->url, PHP_URL_QUERY), $q);
        $this->assertArrayHasKey('token', $q);
        $this->assertSame('crew1@example.test', $q['email']);
        $this->assertStringNotContainsString('&amp;', $body);
    }
}

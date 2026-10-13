<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Mail\PasswordResetLink;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Tests\TestCase;

/** Transactional mail is queued, encrypted at rest in the queue, and delivered by a worker (docs/14). */
class QueuedMailTest extends TestCase
{
    public function test_reset_mail_is_queued_encrypted_and_delivered_by_the_worker(): void
    {
        config(['queue.default' => 'database']);
        [$user] = $this->makeMember($this->makeTenant('SFAI'), Role::Crew, 'crew1');

        $this->postJson('/api/v1/auth/forgot-password', ['email' => $user->email])->assertStatus(202);

        // nothing was sent inside the request; the job waits in the queue...
        $this->assertSame(0, count($this->app['mailer']->getSymfonyTransport()->messages()));
        $payload = (string) DB::table('jobs')->value('payload');
        $this->assertNotSame('', $payload);
        // ...and the link and the address are NOT readable in the jobs table
        $this->assertStringNotContainsString('reset-password', $payload);
        $this->assertStringNotContainsString($user->email, $payload);
        $this->assertStringNotContainsString('token=', $payload);

        Artisan::call('queue:work', ['--once' => true, '--queue' => 'default', '--stop-when-empty' => true]);

        $this->assertSame(0, DB::table('jobs')->count());
        $messages = $this->app['mailer']->getSymfonyTransport()->messages();
        $this->assertCount(1, $messages);
        $this->assertStringContainsString('reset-password', $messages[0]->getOriginalMessage()->toString());
    }

    public function test_a_permanent_failure_is_logged_without_recipient_or_content(): void
    {
        Log::spy();

        (new PasswordResetLink('https://x.example/reset?token=SECRET'))->failed(new RuntimeException('smtp: rejected juan@example.test'));

        Log::shouldHaveReceived('error')->once()->withArgs(function (string $message, array $context) {
            return $context === ['mailable' => 'PasswordResetLink', 'error' => 'RuntimeException']
                && ! str_contains($message, 'SECRET');
        });
    }

    public function test_transactional_mails_retry_with_backoff(): void
    {
        $mail = new PasswordResetLink('u');
        $this->assertSame(4, $mail->tries);
        $this->assertSame([30, 120, 600], $mail->backoff());
    }
}

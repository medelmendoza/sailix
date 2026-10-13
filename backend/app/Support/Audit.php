<?php

namespace App\Support;

use App\Models\AuditLog;
use App\Models\PlatformAdmin;
use App\Models\User;
use Illuminate\Support\Facades\Auth;

/** Append-only audit trail. Metadata is redacted by key before storage. */
final class Audit
{
    private const REDACT = ['password', 'password_confirmation', 'current_password', 'token', 'otp', 'secret', 'totp_secret', 'ticket'];

    /** @param array<string, mixed> $metadata */
    public static function record(
        string $action,
        ?string $tenantId = null,
        ?object $subject = null,
        array $metadata = [],
        ?object $actor = null,
    ): void {
        $actor ??= Auth::guard('platform')->user() ?? Auth::guard('web')->user();
        $request = request();

        [$actorType, $actorId] = match (true) {
            $actor instanceof PlatformAdmin => ['platform_admin', $actor->getKey()],
            $actor instanceof User => ['user', $actor->getKey()],
            default => ['system', null],
        };

        (new AuditLog)->forceFill([
            'tenant_id' => $tenantId,
            'actor_type' => $actorType,
            'actor_id' => $actorId,
            'action' => $action,
            'subject_type' => $subject ? class_basename($subject) : null,
            'subject_id' => $subject && method_exists($subject, 'getKey') ? $subject->getKey() : null,
            'ip' => $request->ip(),
            'user_agent' => mb_substr((string) $request->userAgent(), 0, 255),
            'metadata' => $metadata === [] ? null : self::redact($metadata),
        ])->save();
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private static function redact(array $data): array
    {
        foreach ($data as $key => $value) {
            if (in_array(strtolower((string) $key), self::REDACT, true)) {
                $data[$key] = '[redacted]';
            } elseif (is_array($value)) {
                $data[$key] = self::redact($value);
            }
        }

        return $data;
    }
}

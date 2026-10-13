<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Identity\SessionRevoker;
use App\Identity\TokenIssuer;
use App\Models\User;
use App\Support\ApiProblem;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

/** Link-based reset (docs/04): never emails a password, never reveals whether an account exists. */
class PasswordResetController extends Controller
{
    public function forgot(ForgotPasswordRequest $request): JsonResponse
    {
        // Only ACTIVE accounts get a link; the answer is the same either way.
        $status = Password::sendResetLink(['email' => $request->string('email')->toString(), 'status' => 'active']);

        if ($status === Password::RESET_LINK_SENT) {
            Audit::record('auth.password_reset_requested');
        }

        return response()->json(['data' => ['status' => 'received']], 202);
    }

    public function reset(ResetPasswordRequest $request, TokenIssuer $tokens, SessionRevoker $sessions): Response
    {
        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token') + ['status' => 'active'],
            function (User $user, string $password) use ($tokens, $sessions): void {
                $user->forceFill([
                    'password' => $password,
                    'remember_token' => Str::random(60),
                    'email_verified_at' => $user->email_verified_at ?? now(), // the link proved mailbox ownership
                ])->save();

                $tokens->revokeForUser($user);   // every mobile token
                $sessions->revokeForUser($user); // every browser session
                Audit::record('auth.password_reset', null, $user, [], $user);
            },
        );

        if ($status !== Password::PASSWORD_RESET) {
            // unknown email, inactive account, wrong/expired/used token: one indistinguishable answer
            throw new ApiProblem(422, 'invalid_reset_token', 'The reset link is invalid or has expired.', ['token' => ['The reset link is invalid or has expired.']]);
        }

        return response()->noContent();
    }
}

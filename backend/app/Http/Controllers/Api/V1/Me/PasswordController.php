<?php

namespace App\Http\Controllers\Api\V1\Me;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ChangePasswordRequest;
use App\Identity\SessionRevoker;
use App\Identity\TokenIssuer;
use App\Models\PersonalAccessToken;
use App\Models\User;
use App\Support\ApiProblem;
use App\Support\Audit;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Hash;

class PasswordController extends Controller
{
    public function update(ChangePasswordRequest $request, TokenIssuer $tokens, SessionRevoker $sessions): Response
    {
        /** @var User $user */
        $user = $request->user();

        if (! Hash::check($request->string('current_password')->toString(), $user->password)) {
            throw new ApiProblem(422, 'invalid_current_password', 'The current password is incorrect.', ['current_password' => ['The current password is incorrect.']]);
        }

        $user->forceFill(['password' => $request->string('password')->toString()])->save();

        // Sign out everywhere else; the caller's own token/session stays valid.
        $current = $user->currentAccessToken();
        $tokens->revokeForUser($user, $current instanceof PersonalAccessToken ? $current->getKey() : null);
        $sessions->revokeForUser($user, $request->hasSession() ? $request->session()->getId() : null);
        Audit::record('auth.password_changed', $request->attributes->get('membership')?->tenant_id, $user, [], $user);

        return response()->noContent();
    }
}

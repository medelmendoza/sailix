<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\PlatformLoginRequest;
use App\Models\PlatformAdmin;
use App\Support\ApiProblem;
use App\Support\Audit;
use App\Support\PlatformMfa;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use PragmaRX\Google2FA\Google2FA;

/** Superadmin login: email + password + TOTP (mandatory outside development), separate guard (docs/04). */
class AuthController extends Controller
{
    public function store(PlatformLoginRequest $request): JsonResponse
    {
        $admin = PlatformAdmin::where('email', $request->string('email')->toString())->first();

        static $dummy = null;
        $dummy ??= Hash::make('not-a-real-password');
        $passwordOk = Hash::check($request->string('password')->toString(), $admin->password ?? $dummy);

        // Same response for unknown account / wrong password / wrong code.
        $fail = new ApiProblem(401, 'invalid_credentials', 'The credentials are incorrect.');
        if (! $admin || ! $passwordOk) {
            throw $fail;
        }
        if (! $admin->isActive()) {
            throw ApiProblem::forbidden('account_suspended', 'This account cannot sign in.');
        }
        $mfa = PlatformMfa::required();
        if ($mfa) {
            if ($admin->totp_secret === null || $admin->totp_confirmed_at === null) {
                throw ApiProblem::forbidden('mfa_not_enrolled', 'Multi-factor authentication is not enrolled.');
            }

            $step = (new Google2FA)->verifyKeyNewer($admin->totp_secret, $request->string('otp')->toString(), $admin->totp_last_step ?? 0);
            if ($step === false) {
                Audit::record('platform.login_failed', null, $admin, [], $admin);
                throw $fail;
            }
            $admin->forceFill(['totp_last_step' => $step, 'last_login_at' => now()])->save();
        } else {
            $admin->forceFill(['last_login_at' => now()])->save(); // development only: no code asked for
        }

        Auth::guard('web')->logout();
        Auth::guard('platform')->login($admin);
        $request->session()->regenerate();
        $request->session()->forget('membership_id');
        $request->session()->put('platform_last_activity', now()->timestamp);
        Audit::record('platform.login', null, $admin, $mfa ? [] : ['mfa' => 'skipped'], $admin);

        return response()->json(['data' => ['id' => $admin->getKey(), 'name' => $admin->name, 'email' => $admin->email]]);
    }

    /** What the sign-in page needs to know before it asks: whether a one-time code is part of signing in here. */
    public function options(): JsonResponse
    {
        return response()->json(['data' => ['otp_required' => PlatformMfa::required()]]);
    }

    public function show(Request $request): JsonResponse
    {
        $admin = Auth::guard('platform')->user();

        return response()->json(['data' => ['id' => $admin->getKey(), 'name' => $admin->name, 'email' => $admin->email, 'abilities' => ['platform.manage']]]);
    }

    public function destroy(Request $request): Response
    {
        Auth::guard('platform')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->noContent();
    }
}

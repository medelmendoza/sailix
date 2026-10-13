<?php

use App\Http\Controllers\Api\V1\Auth\InvitationController;
use App\Http\Controllers\Api\V1\Auth\PasswordResetController;
use App\Http\Controllers\Api\V1\Auth\RegisterController;
use App\Http\Controllers\Api\V1\Auth\SessionController;
use App\Http\Controllers\Api\V1\Auth\TokenController;
use App\Http\Controllers\Api\V1\Me;
use App\Http\Controllers\Api\V1\MeController;
use App\Http\Controllers\Api\V1\Modules;
use App\Http\Controllers\Api\V1\Platform;
use App\Http\Controllers\Api\V1\Tenant;
use Illuminate\Support\Facades\Route;

// Prefix /api/v1 is applied in bootstrap/app.php.

// Public (throttled)
Route::middleware('throttle:login')->group(function () {
    Route::post('auth/token', [TokenController::class, 'store']);
    Route::post('auth/token/select', [TokenController::class, 'select']);
    Route::post('auth/session', [SessionController::class, 'store']);
    Route::post('auth/session/select', [SessionController::class, 'select']);
    Route::post('platform/auth/session', [Platform\AuthController::class, 'store'])->middleware('throttle:platform-login');
});
Route::post('auth/invitations/accept', [InvitationController::class, 'accept'])->middleware('throttle:invitation');
Route::post('auth/register', [RegisterController::class, 'store'])->middleware('throttle:register');
Route::post('auth/forgot-password', [PasswordResetController::class, 'forgot'])->middleware('throttle:forgot');
Route::post('auth/reset-password', [PasswordResetController::class, 'reset'])->middleware('throttle:reset');

// Tenant-authenticated (mobile token or web cookie session). Tenant context derived server-side.
Route::middleware(['auth:sanctum', 'tenant.context', 'throttle:api'])->group(function () {
    Route::get('me', [MeController::class, 'show']);
    Route::put('me/password', [Me\PasswordController::class, 'update'])->middleware('throttle:password-change');
    Route::post('me/deletion-request', [Me\DeletionRequestController::class, 'store'])->middleware('throttle:deletion');

    Route::delete('auth/token', [TokenController::class, 'destroy']);
    Route::post('auth/token/refresh', [TokenController::class, 'refresh']);
    Route::post('auth/token/switch', [TokenController::class, 'switch']);
    Route::delete('auth/session', [SessionController::class, 'destroy']);

    Route::prefix('tenant')->group(function () {
        Route::get('/', [Tenant\TenantController::class, 'show']);
        Route::patch('/', [Tenant\TenantController::class, 'update']);
        Route::get('users', [Tenant\UserController::class, 'index']);
        Route::patch('users/{membership}', [Tenant\UserController::class, 'update']);
        Route::get('audit-logs', [Tenant\AuditLogController::class, 'index']);
        Route::get('deletion-requests', [Tenant\DeletionRequestController::class, 'index']);
        Route::get('modules', [Tenant\ModuleController::class, 'index']);
        Route::put('modules/{module}', [Tenant\ModuleController::class, 'update']);
    });

    // Module gateways: module enabled for the organization + role ability + approved upstream, checked per request.
    Route::prefix('modules/tala')->middleware('module:tala')->group(function () {
        Route::get('link', [Modules\TalaController::class, 'link']);
        Route::post('link', [Modules\TalaController::class, 'store'])->middleware('throttle:module-link');
        Route::delete('link', [Modules\TalaController::class, 'destroy']);
        Route::middleware('throttle:module-read')->group(function () {
            Route::get('courses', [Modules\TalaController::class, 'courses']);
            Route::get('courses/{assignId}', [Modules\TalaController::class, 'course'])->where('assignId', '[A-Za-z0-9_-]{1,64}');
            Route::get('courses/{assignId}/materials/{materialId}', [Modules\TalaController::class, 'material'])
                ->where(['assignId' => '[A-Za-z0-9_-]{1,64}', 'materialId' => '[A-Za-z0-9_-]{1,64}']);
        });
    });
});

// Platform (superadmin): own guard, never a tenant context.
Route::prefix('platform')->middleware(['auth:platform', 'platform.context', 'throttle:api'])->group(function () {
    Route::get('me', [Platform\AuthController::class, 'show']);
    Route::delete('auth/session', [Platform\AuthController::class, 'destroy']);

    Route::get('tenants', [Platform\TenantController::class, 'index']);
    Route::post('tenants', [Platform\TenantController::class, 'store']);
    Route::get('tenants/{tenant}', [Platform\TenantController::class, 'show']);
    Route::patch('tenants/{tenant}', [Platform\TenantController::class, 'update']);
    Route::post('tenants/{tenant}/{action}', [Platform\TenantController::class, 'transition'])
        ->whereIn('action', ['activate', 'suspend', 'reactivate', 'deactivate', 'archive']);
    Route::get('tenants/{tenant}/admins', [Platform\TenantAdminController::class, 'index']);
    Route::post('tenants/{tenant}/admins', [Platform\TenantAdminController::class, 'store']);

    Route::get('tenants/{tenant}/modules', [Platform\TenantModuleController::class, 'index']);
    Route::put('tenants/{tenant}/modules/{module}', [Platform\TenantModuleController::class, 'update']);

    Route::get('settings', [Platform\SettingsController::class, 'show']);
    Route::patch('settings', [Platform\SettingsController::class, 'update']);
    Route::get('audit-logs', [Platform\AuditLogController::class, 'index']);
});

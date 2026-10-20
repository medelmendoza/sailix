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
    Route::get('announcements', [Me\AnnouncementController::class, 'index']);
    Route::get('announcements/{announcement}', [Me\AnnouncementController::class, 'show']);
    Route::get('announcements/{announcement}/file', [Me\AnnouncementController::class, 'file']);
    Route::put('announcements/{announcement}/read', [Me\AnnouncementController::class, 'read']);
    // Call-it: only for organizations that have the module on (and a role that may use it)
    Route::prefix('callit')->middleware('module:callit')->group(function () {
        Route::get('stats', [Me\CallItController::class, 'stats']);
        Route::get('reports', [Me\CallItController::class, 'index']);
        Route::post('reports', [Me\CallItController::class, 'store'])->middleware('throttle:callit-write');
        Route::get('reports/{report}', [Me\CallItController::class, 'show']);
        Route::patch('reports/{report}', [Me\CallItController::class, 'update'])->middleware('throttle:callit-write');
        Route::delete('reports/{report}', [Me\CallItController::class, 'destroy']);
        Route::post('reports/{report}/file', [Me\CallItController::class, 'attach'])->middleware('throttle:document-upload');
        Route::delete('reports/{report}/file', [Me\CallItController::class, 'detach']);
        Route::get('reports/{report}/file', [Me\CallItController::class, 'file']);
    });
    Route::get('document-types', [Me\DocumentController::class, 'types']);
    Route::get('document-requests', [Me\DocumentController::class, 'requests']);
    Route::get('documents', [Me\DocumentController::class, 'index']);
    Route::post('documents', [Me\DocumentController::class, 'store'])->name('documents.store')->middleware('throttle:document-upload');
    Route::get('documents/{document}', [Me\DocumentController::class, 'show']);
    Route::get('documents/{document}/file', [Me\DocumentController::class, 'file']);
    Route::post('documents/{document}/resubmit', [Me\DocumentController::class, 'resubmit'])->name('documents.resubmit')->middleware('throttle:document-upload');
    Route::get('finance/status', [Me\FinanceController::class, 'status']);
    Route::post('finance/unlock', [Me\FinanceController::class, 'unlock'])->middleware('throttle:finance-unlock');
    Route::get('payslips', [Me\FinanceController::class, 'payslips']);
    Route::get('payslips/{payslip}', [Me\FinanceController::class, 'payslip']);
    Route::get('loans', [Me\FinanceController::class, 'loans']);
    Route::get('todos', [Me\TodoController::class, 'index']);
    Route::patch('todos/{todo}', [Me\TodoController::class, 'update']);
    Route::post('me/feedback', [Me\FeedbackController::class, 'store'])->middleware('throttle:feedback');

    Route::delete('auth/token', [TokenController::class, 'destroy']);
    Route::post('auth/token/refresh', [TokenController::class, 'refresh']);
    Route::post('auth/token/switch', [TokenController::class, 'switch']);
    Route::delete('auth/session', [SessionController::class, 'destroy']);

    Route::prefix('tenant')->group(function () {
        Route::get('/', [Tenant\TenantController::class, 'show']);
        Route::patch('/', [Tenant\TenantController::class, 'update']);
        Route::get('users', [Tenant\UserController::class, 'index']);
        Route::patch('users/{membership}', [Tenant\UserController::class, 'update']);
        Route::get('crew/fleets', [Tenant\CrewController::class, 'fleets']);
        Route::get('crew', [Tenant\CrewController::class, 'index'])->name('crew.index');
        Route::get('crew/{membership}', [Tenant\CrewController::class, 'show'])->name('crew.show');
        Route::patch('crew/{membership}', [Tenant\CrewController::class, 'update'])->name('crew.update');
        Route::get('crew/{membership}/documents', [Tenant\CrewDocumentController::class, 'index']);
        Route::put('crew/{membership}/document-requests/{documentType}', [Tenant\CrewDocumentController::class, 'request']);
        Route::delete('crew/{membership}/document-requests/{documentType}', [Tenant\CrewDocumentController::class, 'withdraw']);
        Route::post('crew/{membership}/password-reset', [Tenant\CrewController::class, 'passwordReset'])->middleware('throttle:crew-reset');
        Route::get('audit-logs', [Tenant\AuditLogController::class, 'index']);
        Route::get('deletion-requests', [Tenant\DeletionRequestController::class, 'index']);
        Route::get('feedback', [Tenant\FeedbackController::class, 'index']);
        Route::get('finance/imports/{kind}/template', [Tenant\FinanceImportController::class, 'template']);
        Route::post('finance/imports/{kind}', [Tenant\FinanceImportController::class, 'import'])->middleware('throttle:finance-import');
        Route::get('callit/reports', [Tenant\CallItController::class, 'index']);
        Route::get('callit/reports/{report}/file', [Tenant\CallItController::class, 'file']);
        Route::post('callit/reports/{report}/review', [Tenant\CallItController::class, 'review']);
        Route::get('document-types', [Tenant\DocumentTypeController::class, 'index']);
        Route::post('document-types', [Tenant\DocumentTypeController::class, 'store']);
        Route::patch('document-types/{documentType}', [Tenant\DocumentTypeController::class, 'update']);
        Route::delete('document-types/{documentType}', [Tenant\DocumentTypeController::class, 'destroy']);
        Route::get('documents', [Tenant\DocumentController::class, 'index']);
        Route::get('documents/{document}/file', [Tenant\DocumentController::class, 'file']);
        Route::post('documents/{document}/approve', [Tenant\DocumentController::class, 'approve']);
        Route::post('documents/{document}/reject', [Tenant\DocumentController::class, 'reject']);
        Route::get('todos', [Tenant\TodoController::class, 'index']);
        Route::post('todos', [Tenant\TodoController::class, 'store']);
        Route::patch('todos/{todo}', [Tenant\TodoController::class, 'update']);
        Route::delete('todos/{todo}', [Tenant\TodoController::class, 'destroy']);
        Route::get('announcements', [Tenant\AnnouncementController::class, 'index']);
        Route::post('announcements', [Tenant\AnnouncementController::class, 'store']);
        Route::patch('announcements/{announcement}', [Tenant\AnnouncementController::class, 'update']);
        Route::delete('announcements/{announcement}', [Tenant\AnnouncementController::class, 'destroy']);
        Route::post('announcements/{announcement}/attachment', [Tenant\AnnouncementController::class, 'attach'])->middleware('throttle:document-upload');
        Route::delete('announcements/{announcement}/attachment', [Tenant\AnnouncementController::class, 'detach']);
        Route::get('announcements/{announcement}/file', [Tenant\AnnouncementController::class, 'file']);
        Route::get('modules', [Tenant\ModuleController::class, 'index']);
        Route::put('modules/{module}', [Tenant\ModuleController::class, 'update']);
    });

    // Module gateways: module enabled for the organization + role ability + approved upstream, checked per request.
    Route::prefix('modules/tala')->middleware('module:tala')->group(function () {
        Route::get('link', [Modules\TalaController::class, 'link']);
        Route::post('link', [Modules\TalaController::class, 'store'])->middleware('throttle:module-link');
        Route::delete('link', [Modules\TalaController::class, 'destroy']);
        Route::post('courses/join', [Modules\TalaController::class, 'join'])->middleware(['throttle:module-write', 'throttle:course-join']);
        Route::post('courses/{assignId}/progress', [Modules\TalaController::class, 'progress'])->where('assignId', '[A-Za-z0-9_-]{1,64}')->middleware('throttle:module-write');
        Route::post('courses/{assignId}/quizzes/{quizId}/attempts', [Modules\TalaController::class, 'attempt'])
            ->where(['assignId' => '[A-Za-z0-9_-]{1,64}', 'quizId' => '[A-Za-z0-9_-]{1,64}'])->middleware(['throttle:module-write', 'throttle:quiz-attempt']);
        Route::post('courses/{assignId}/flashcards/{cardId}/ratings', [Modules\TalaController::class, 'ratings'])
            ->where(['assignId' => '[A-Za-z0-9_-]{1,64}', 'cardId' => '[A-Za-z0-9_-]{1,64}'])->middleware('throttle:module-write');
        Route::middleware('throttle:module-read')->group(function () {
            Route::get('courses/{assignId}/flashcards/{cardId}', [Modules\TalaController::class, 'flashcards'])
                ->where(['assignId' => '[A-Za-z0-9_-]{1,64}', 'cardId' => '[A-Za-z0-9_-]{1,64}']);
            Route::get('courses/{assignId}/quizzes/{quizId}', [Modules\TalaController::class, 'quiz'])
                ->where(['assignId' => '[A-Za-z0-9_-]{1,64}', 'quizId' => '[A-Za-z0-9_-]{1,64}']);
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

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
use App\Http\Controllers\Api\V1\PublicTenantController;
use App\Http\Controllers\Api\V1\Tenant;
use Illuminate\Support\Facades\Route;

// Prefix /api/v1 is applied in bootstrap/app.php.

// Public (throttled)
Route::middleware('throttle:login')->group(function () {
    Route::post('auth/token', [TokenController::class, 'store']);
    Route::post('auth/token/select', [TokenController::class, 'select']);
    Route::post('auth/session', [SessionController::class, 'store']);
    Route::post('auth/session/select', [SessionController::class, 'select']);
    Route::get('platform/auth/options', [Platform\AuthController::class, 'options'])->middleware('throttle:api');
    Route::post('platform/auth/session', [Platform\AuthController::class, 'store'])->middleware('throttle:platform-login');
});
// Public organization look (name, colours, logo): no sign-in, never any people or data
Route::get('public/tenant', [PublicTenantController::class, 'show'])->middleware('throttle:api');
Route::get('public/tenants/{slug}/logo', [PublicTenantController::class, 'logo'])->middleware('throttle:api');
Route::get('public/tenants/{slug}/favicon', [PublicTenantController::class, 'favicon'])->middleware('throttle:api');
Route::post('auth/invitations/accept', [InvitationController::class, 'accept'])->middleware('throttle:invitation');
Route::post('auth/register', [RegisterController::class, 'store'])->middleware('throttle:register');
Route::post('auth/forgot-password', [PasswordResetController::class, 'forgot'])->middleware('throttle:forgot');
Route::post('auth/reset-password', [PasswordResetController::class, 'reset'])->middleware('throttle:reset');

// Tenant-authenticated (mobile token or web cookie session). Tenant context derived server-side.
Route::middleware(['auth:sanctum', 'tenant.context', 'throttle:api'])->group(function () {
    Route::get('me', [MeController::class, 'show']);
    Route::put('me/password', [Me\PasswordController::class, 'update'])->middleware('throttle:password-change');
    Route::post('me/deletion-request', [Me\DeletionRequestController::class, 'store'])->middleware('throttle:deletion');
    Route::get('announcements', [Me\AnnouncementController::class, 'index'])->middleware('feature:announcements');
    Route::get('announcements/{announcement}', [Me\AnnouncementController::class, 'show'])->middleware('feature:announcements');
    Route::get('announcements/{announcement}/file', [Me\AnnouncementController::class, 'file'])->middleware('feature:announcements');
    Route::put('announcements/{announcement}/read', [Me\AnnouncementController::class, 'read'])->middleware('feature:announcements');
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
    Route::get('document-types', [Me\DocumentController::class, 'types'])->middleware('feature:documents');
    Route::get('document-requests', [Me\DocumentController::class, 'requests'])->middleware('feature:documents');
    Route::get('documents', [Me\DocumentController::class, 'index'])->middleware('feature:documents');
    Route::post('documents', [Me\DocumentController::class, 'store'])->name('documents.store')->middleware('throttle:document-upload')->middleware('feature:documents');
    Route::get('documents/{document}', [Me\DocumentController::class, 'show'])->middleware('feature:documents');
    Route::get('documents/{document}/file', [Me\DocumentController::class, 'file'])->middleware('feature:documents');
    Route::post('documents/{document}/resubmit', [Me\DocumentController::class, 'resubmit'])->name('documents.resubmit')->middleware('throttle:document-upload')->middleware('feature:documents');
    Route::get('finance/status', [Me\FinanceController::class, 'status'])->middleware('feature:finance');
    Route::post('finance/unlock', [Me\FinanceController::class, 'unlock'])->middleware('throttle:finance-unlock')->middleware('feature:finance');
    Route::get('payslips', [Me\FinanceController::class, 'payslips'])->middleware('feature:finance');
    Route::get('payslips/{payslip}', [Me\FinanceController::class, 'payslip'])->middleware('feature:finance');
    Route::get('loans', [Me\FinanceController::class, 'loans'])->middleware('feature:finance');
    Route::get('todos', [Me\TodoController::class, 'index'])->middleware('feature:todos');
    Route::patch('todos/{todo}', [Me\TodoController::class, 'update'])->middleware('feature:todos');
    Route::post('me/feedback', [Me\FeedbackController::class, 'store'])->middleware('throttle:feedback')->middleware('feature:feedback');

    Route::delete('auth/token', [TokenController::class, 'destroy']);
    Route::post('auth/token/refresh', [TokenController::class, 'refresh']);
    Route::post('auth/token/switch', [TokenController::class, 'switch']);
    Route::delete('auth/session', [SessionController::class, 'destroy']);

    Route::prefix('tenant')->group(function () {
        Route::get('/', [Tenant\TenantController::class, 'show']);
        Route::patch('/', [Tenant\TenantController::class, 'update']);
        Route::get('users', [Tenant\UserController::class, 'index']);
        Route::patch('users/{membership}', [Tenant\UserController::class, 'update']);
        Route::get('branding', [Tenant\BrandingController::class, 'show'])->middleware('feature:branding');
        Route::patch('branding', [Tenant\BrandingController::class, 'update'])->middleware('feature:branding');
        Route::post('branding/{kind}', [Tenant\BrandingController::class, 'setImage'])->middleware('throttle:document-upload')->middleware('feature:branding');
        Route::delete('branding/{kind}', [Tenant\BrandingController::class, 'removeImage'])->middleware('feature:branding');
        Route::get('domains', [Tenant\DomainController::class, 'index'])->middleware('feature:branding');
        Route::post('domains', [Tenant\DomainController::class, 'store'])->middleware('feature:branding');
        Route::post('domains/{domain}/verify', [Tenant\DomainController::class, 'verify'])->middleware('throttle:module-link')->middleware('feature:branding');
        Route::delete('domains/{domain}', [Tenant\DomainController::class, 'destroy'])->middleware('feature:branding');
        Route::get('crew/fleets', [Tenant\CrewController::class, 'fleets'])->middleware('feature:crew');
        Route::get('crew', [Tenant\CrewController::class, 'index'])->name('crew.index')->middleware('feature:crew');
        Route::get('crew/{membership}', [Tenant\CrewController::class, 'show'])->name('crew.show')->middleware('feature:crew');
        Route::patch('crew/{membership}', [Tenant\CrewController::class, 'update'])->name('crew.update')->middleware('feature:crew');
        Route::get('crew/{membership}/documents', [Tenant\CrewDocumentController::class, 'index'])->middleware('feature:documents');
        Route::put('crew/{membership}/document-requests/{documentType}', [Tenant\CrewDocumentController::class, 'request'])->middleware('feature:documents');
        Route::delete('crew/{membership}/document-requests/{documentType}', [Tenant\CrewDocumentController::class, 'withdraw'])->middleware('feature:documents');
        Route::post('crew/{membership}/password-reset', [Tenant\CrewController::class, 'passwordReset'])->middleware('throttle:crew-reset')->middleware('feature:crew');
        Route::get('audit-logs', [Tenant\AuditLogController::class, 'index']);
        Route::get('deletion-requests', [Tenant\DeletionRequestController::class, 'index']);
        Route::get('feedback', [Tenant\FeedbackController::class, 'index'])->middleware('feature:feedback');
        Route::get('finance/imports/{kind}/template', [Tenant\FinanceImportController::class, 'template'])->middleware('feature:finance');
        Route::post('finance/imports/{kind}', [Tenant\FinanceImportController::class, 'import'])->middleware('throttle:finance-import')->middleware('feature:finance');
        Route::get('callit/reports', [Tenant\CallItController::class, 'index']);
        Route::get('callit/reports/{report}/file', [Tenant\CallItController::class, 'file']);
        Route::post('callit/reports/{report}/review', [Tenant\CallItController::class, 'review']);
        Route::get('document-types', [Tenant\DocumentTypeController::class, 'index'])->middleware('feature:documents');
        Route::post('document-types', [Tenant\DocumentTypeController::class, 'store'])->middleware('feature:documents');
        Route::patch('document-types/{documentType}', [Tenant\DocumentTypeController::class, 'update'])->middleware('feature:documents');
        Route::delete('document-types/{documentType}', [Tenant\DocumentTypeController::class, 'destroy'])->middleware('feature:documents');
        Route::get('documents', [Tenant\DocumentController::class, 'index'])->middleware('feature:documents');
        Route::get('documents/{document}/file', [Tenant\DocumentController::class, 'file'])->middleware('feature:documents');
        Route::post('documents/{document}/approve', [Tenant\DocumentController::class, 'approve'])->middleware('feature:documents');
        Route::post('documents/{document}/reject', [Tenant\DocumentController::class, 'reject'])->middleware('feature:documents');
        Route::get('todos', [Tenant\TodoController::class, 'index'])->middleware('feature:todos');
        Route::post('todos', [Tenant\TodoController::class, 'store'])->middleware('feature:todos');
        Route::patch('todos/{todo}', [Tenant\TodoController::class, 'update'])->middleware('feature:todos');
        Route::delete('todos/{todo}', [Tenant\TodoController::class, 'destroy'])->middleware('feature:todos');
        Route::get('announcements', [Tenant\AnnouncementController::class, 'index'])->middleware('feature:announcements');
        Route::post('announcements', [Tenant\AnnouncementController::class, 'store'])->middleware('feature:announcements');
        Route::patch('announcements/{announcement}', [Tenant\AnnouncementController::class, 'update'])->middleware('feature:announcements');
        Route::delete('announcements/{announcement}', [Tenant\AnnouncementController::class, 'destroy'])->middleware('feature:announcements');
        Route::post('announcements/{announcement}/attachment', [Tenant\AnnouncementController::class, 'attach'])->middleware('throttle:document-upload')->middleware('feature:announcements');
        Route::delete('announcements/{announcement}/attachment', [Tenant\AnnouncementController::class, 'detach'])->middleware('feature:announcements');
        Route::get('announcements/{announcement}/file', [Tenant\AnnouncementController::class, 'file'])->middleware('feature:announcements');
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
    Route::get('tenants/{tenant}/features', [Platform\TenantFeatureController::class, 'index']);
    Route::patch('tenants/{tenant}/features', [Platform\TenantFeatureController::class, 'update']);

    Route::get('tenants/{tenant}/branding', [Platform\TenantBrandingController::class, 'show']);
    Route::patch('tenants/{tenant}/branding', [Platform\TenantBrandingController::class, 'update']);
    Route::post('tenants/{tenant}/branding/reset', [Platform\TenantBrandingController::class, 'reset']);
    Route::post('tenants/{tenant}/branding/{kind}', [Platform\TenantBrandingController::class, 'setImage'])->middleware('throttle:document-upload');
    Route::delete('tenants/{tenant}/branding/{kind}', [Platform\TenantBrandingController::class, 'removeImage']);
    Route::get('tenants/{tenant}/domains', [Platform\TenantDomainController::class, 'index']);
    Route::post('tenants/{tenant}/domains', [Platform\TenantDomainController::class, 'store']);
    Route::post('tenants/{tenant}/domains/{domain}/verify', [Platform\TenantDomainController::class, 'verify']);
    Route::delete('tenants/{tenant}/domains/{domain}', [Platform\TenantDomainController::class, 'destroy']);

    Route::get('settings', [Platform\SettingsController::class, 'show']);
    Route::patch('settings', [Platform\SettingsController::class, 'update']);
    Route::get('audit-logs', [Platform\AuditLogController::class, 'index']);
});

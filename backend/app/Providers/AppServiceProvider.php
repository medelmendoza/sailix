<?php

namespace App\Providers;

use App\Enums\Role;
use App\Models\Membership;
use App\Models\PersonalAccessToken;
use App\Models\User;
use App\Policies\MembershipPolicy;
use App\Support\Net\DnsHostResolver;
use App\Support\Net\HostResolver;
use App\Support\Tenancy\TenantContext;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Laravel\Sanctum\Sanctum;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Request/job scoped: discarded between requests and queued jobs.
        $this->app->scoped(TenantContext::class);
        $this->app->bind(HostResolver::class, DnsHostResolver::class);
    }

    public function boot(): void
    {
        Sanctum::usePersonalAccessTokenModel(PersonalAccessToken::class);

        Gate::policy(Membership::class, MembershipPolicy::class);

        // Ability gates derive from the single role map; they require an established tenant context.
        foreach (collect(Role::cases())->flatMap(fn (Role $r) => $r->abilities())->unique() as $ability) {
            Gate::define($ability, fn (User $user) => app(TenantContext::class)->has()
                && app(TenantContext::class)->role()->can($ability));
        }

        RateLimiter::for('login', fn (Request $r) => [
            Limit::perMinute(5)->by('login:'.mb_strtolower((string) ($r->input('username') ?? $r->input('ticket') ?? '')).'|'.$r->ip()),
            Limit::perMinute(20)->by('login-ip:'.$r->ip()),
        ]);
        RateLimiter::for('platform-login', fn (Request $r) => [
            Limit::perMinute(5)->by('plogin:'.mb_strtolower((string) $r->input('email')).'|'.$r->ip()),
        ]);
        RateLimiter::for('register', fn (Request $r) => [
            Limit::perHour(5)->by('register-ip:'.$r->ip()),
            Limit::perHour(3)->by('register-email:'.mb_strtolower((string) $r->input('email'))),
        ]);
        RateLimiter::for('forgot', fn (Request $r) => [
            Limit::perHour(5)->by('forgot-ip:'.$r->ip()),
            Limit::perHour(3)->by('forgot-email:'.mb_strtolower((string) $r->input('email'))),
        ]);
        RateLimiter::for('reset', fn (Request $r) => Limit::perHour(10)->by('reset-ip:'.$r->ip()));
        RateLimiter::for('password-change', fn (Request $r) => Limit::perMinute(5)->by('pwchange:'.($r->user()?->getAuthIdentifier() ?? $r->ip())));
        RateLimiter::for('deletion', fn (Request $r) => Limit::perDay(3)->by('deletion:'.($r->user()?->getAuthIdentifier() ?? $r->ip())));
        // Linking verifies a password with a third party: keep guessing expensive.
        RateLimiter::for('module-link', fn (Request $r) => Limit::perMinute(5)->by('mlink:'.($r->user()?->getAuthIdentifier() ?? $r->ip())));
        // Every gateway read becomes upstream traffic to a third party we do not operate.
        RateLimiter::for('module-read', fn (Request $r) => Limit::perMinute(60)->by('mread:'.($r->user()?->getAuthIdentifier() ?? $r->ip())));
        RateLimiter::for('module-write', fn (Request $r) => Limit::perMinute(30)->by('mwrite:'.($r->user()?->getAuthIdentifier() ?? $r->ip())));
        // A quiz can be retaken, but not used as an oracle for its answers.
        RateLimiter::for('quiz-attempt', fn (Request $r) => Limit::perHour(10)->by('quiz:'.($r->user()?->getAuthIdentifier() ?? $r->ip()).'|'.$r->route('quizId')));
        RateLimiter::for('invitation', fn (Request $r) => Limit::perHour(10)->by('invite:'.$r->ip()));
        RateLimiter::for('api', fn (Request $r) => Limit::perMinute(120)->by('api:'.($r->user()?->getAuthIdentifier() ?? $r->ip())));
    }
}

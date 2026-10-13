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
        RateLimiter::for('invitation', fn (Request $r) => Limit::perHour(10)->by('invite:'.$r->ip()));
        RateLimiter::for('api', fn (Request $r) => Limit::perMinute(120)->by('api:'.($r->user()?->getAuthIdentifier() ?? $r->ip())));
    }
}

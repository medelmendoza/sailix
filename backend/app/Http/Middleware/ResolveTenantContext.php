<?php

namespace App\Http\Middleware;

use App\Identity\MembershipDirectory;
use App\Models\PersonalAccessToken;
use App\Models\User;
use App\Support\ApiProblem;
use App\Support\Tenancy\TenantContext;
use App\Tenancy\AddressedTenant;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Establishes the tenant context from the AUTHENTICATED credential (membership bound to the token
 * or stored in the server-side session). Re-validates user, membership and tenant status on every
 * request. Client-supplied tenant identifiers are never used to choose data (docs/02 §6).
 */
class ResolveTenantContext
{
    public function __construct(private MembershipDirectory $directory, private TenantContext $context, private AddressedTenant $addressed) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (! $user instanceof User) {
            throw ApiProblem::unauthenticated();
        }

        $token = $user->currentAccessToken();
        $viaToken = $token instanceof PersonalAccessToken;
        $membershipId = $viaToken
            ? $token->membership_id
            : ($request->hasSession() ? $request->session()->get('membership_id') : null);

        if (! is_string($membershipId)) {
            throw ApiProblem::unauthenticated('No organization is bound to this credential.');
        }

        $membership = $this->directory->findForUser($membershipId, $user);
        if (! $membership) {
            throw ApiProblem::unauthenticated('The credential is no longer valid.');
        }
        if (! $user->isActive()) {
            throw ApiProblem::forbidden('account_suspended', 'This account is suspended.');
        }
        if (! $membership->tenant->isActive()) {
            throw ApiProblem::forbidden('tenant_suspended', 'Your organization is not active.');
        }
        if (! $membership->isActive()) {
            throw ApiProblem::forbidden('membership_suspended', 'Your access to this organization is not active.');
        }
        if (! $viaToken && ! $membership->role->canUseWeb()) {
            throw ApiProblem::forbidden('web_access_denied', 'This account cannot use the web portal.');
        }

        // A credential is good only for the organization it was issued for. When the request's address names an
        // organization, replaying another organization's token or session on it authenticates nothing.
        if ($this->addressed->has() && $this->addressed->get()->getKey() !== $membership->tenant_id) {
            throw ApiProblem::unauthenticated('This credential belongs to another organization.');
        }

        $hint = $request->header(config('sailix.tenant_hint_header'));
        if ($hint !== null && ! in_array($hint, [$membership->tenant_id, $membership->tenant->code], true)) {
            throw ApiProblem::conflict('tenant_mismatch', 'The tenant hint does not match the authenticated organization.');
        }

        $this->context->clear();
        $this->context->set($membership->tenant_id, $membership->getKey(), $user->getKey(), $membership->role);
        $request->attributes->set('membership', $membership);

        // Context lives exactly as long as this request (also guards long-lived workers and tests).
        try {
            return $next($request);
        } finally {
            $this->context->clear();
        }
    }
}

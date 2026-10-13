<?php

namespace App\Modules\Tala;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/** Validation rule for the platform `tala_api_base_url` setting. */
final class ApprovedTalaEndpoint implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value)) {
            $fail('The :attribute must be a URL.');

            return;
        }

        try {
            app(TalaEndpointGuard::class)->assertSafe($value);
        } catch (UnsafeEndpoint $e) {
            $fail("The :attribute is not an approved Tala endpoint ({$e->reason}).");
        }
    }
}

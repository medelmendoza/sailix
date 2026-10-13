<?php

namespace App\Support\Net;

/** DNS seam: production uses real DNS, tests bind a fake (no network in tests). */
interface HostResolver
{
    /** @return list<string> all A and AAAA addresses for the host (empty when unresolvable) */
    public function resolve(string $host): array;
}

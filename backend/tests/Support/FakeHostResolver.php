<?php

namespace Tests\Support;

use App\Support\Net\HostResolver;

/** Deterministic DNS for tests: no network is ever used. */
final class FakeHostResolver implements HostResolver
{
    /** @param array<string, list<string>> $records */
    public function __construct(private array $records = []) {}

    public function resolve(string $host): array
    {
        return $this->records[strtolower($host)] ?? [];
    }
}

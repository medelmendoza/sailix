<?php

namespace Tests;

use App\Support\Net\HostResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Http;
use Tests\Support\FakeHostResolver;
use Tests\Support\Fixtures;

abstract class TestCase extends BaseTestCase
{
    use Fixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Tests must never touch the network (Tala or anything else): outbound HTTP fails loudly and DNS is
        // answered by an empty fake unless a test installs records via fakeTalaDns().
        Http::preventStrayRequests();
        $this->app->instance(HostResolver::class, new FakeHostResolver([]));
    }
}

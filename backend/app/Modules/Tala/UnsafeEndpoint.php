<?php

namespace App\Modules\Tala;

use RuntimeException;

/** The configured/derived Tala endpoint is not an approved, public HTTPS destination. */
class UnsafeEndpoint extends RuntimeException
{
    public function __construct(public readonly string $reason, string $message)
    {
        parent::__construct($message);
    }
}

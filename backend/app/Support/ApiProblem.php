<?php

namespace App\Support;

use RuntimeException;

/** An expected API failure rendered as RFC 9457 problem+json with a stable machine code. */
class ApiProblem extends RuntimeException
{
    /** @param array<string, list<string>> $errors */
    public function __construct(
        public readonly int $status,
        public readonly string $problemCode,
        string $detail = '',
        public readonly array $errors = [],
        /** @var array<string, string> */
        public readonly array $headers = [],
    ) {
        parent::__construct($detail !== '' ? $detail : $problemCode);
    }

    public static function forbidden(string $code = 'forbidden', string $detail = 'This action is not allowed.'): self
    {
        return new self(403, $code, $detail);
    }

    public static function notFound(string $detail = 'Resource not found.'): self
    {
        return new self(404, 'not_found', $detail);
    }

    public static function unauthenticated(string $detail = 'Authentication is required.'): self
    {
        return new self(401, 'unauthenticated', $detail);
    }

    public static function conflict(string $code, string $detail): self
    {
        return new self(409, $code, $detail);
    }

    public static function invalid(string $code, string $detail): self
    {
        return new self(422, $code, $detail);
    }
}

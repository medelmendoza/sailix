<?php

namespace App\Tenancy;

/** Reads the TXT records of a DNS name. A seam so tests do not need real DNS. */
interface DomainVerifier
{
    /** @return list<string> */
    public function txtRecords(string $name): array;
}

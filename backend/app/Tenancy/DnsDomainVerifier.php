<?php

namespace App\Tenancy;

final class DnsDomainVerifier implements DomainVerifier
{
    public function txtRecords(string $name): array
    {
        $records = @dns_get_record($name, DNS_TXT);
        if (! is_array($records)) {
            return [];
        }

        return array_map(fn ($r) => trim((string) ($r['txt'] ?? implode('', $r['entries'] ?? []))), $records);
    }
}

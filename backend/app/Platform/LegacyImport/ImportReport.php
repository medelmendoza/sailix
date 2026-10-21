<?php

namespace App\Platform\LegacyImport;

/** What an import did, in counts and legacy ids only (never names, emails or other personal details). */
final class ImportReport
{
    /** @var array<string, array{created: int, updated: int, skipped: int}> */
    public array $entities = [];

    /** @var list<string> */
    public array $notes = [];

    public function created(string $entity): void
    {
        $this->bump($entity, 'created');
    }

    public function updated(string $entity): void
    {
        $this->bump($entity, 'updated');
    }

    public function skipped(string $entity, string $legacyId, string $why): void
    {
        $this->bump($entity, 'skipped');
        $this->notes[] = "skipped {$entity} {$legacyId}: {$why}";
    }

    public function note(string $message): void
    {
        $this->notes[] = $message;
    }

    private function bump(string $entity, string $key): void
    {
        $this->entities[$entity] ??= ['created' => 0, 'updated' => 0, 'skipped' => 0];
        $this->entities[$entity][$key]++;
    }
}

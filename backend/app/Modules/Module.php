<?php

namespace App\Modules;

/**
 * Module registry (ADR-0016). Adding a module = a case here, its abilities (derived below, picked up by
 * Role and the Gate loop automatically), an adapter under app/Modules/<Name>, and a mobile feature folder.
 * Deliberately NOT an interface/plugin framework until a second module exists.
 */
enum Module: string
{
    case Tala = 'tala';

    public function label(): string
    {
        return match ($this) {
            self::Tala => 'Tala',
        };
    }

    public function useAbility(): string
    {
        return "module.{$this->value}.use";
    }

    public function manageAbility(): string
    {
        return "module.{$this->value}.manage";
    }

    /** Platform setting holding the approved HTTPS origin this module talks to (null = module has no upstream). */
    public function endpointSetting(): ?string
    {
        return match ($this) {
            self::Tala => 'tala_api_base_url',
        };
    }

    /** @return list<string> */
    public static function useAbilities(): array
    {
        return array_map(fn (self $m) => $m->useAbility(), self::cases());
    }

    /** @return list<string> */
    public static function manageAbilities(): array
    {
        return array_map(fn (self $m) => $m->manageAbility(), self::cases());
    }
}

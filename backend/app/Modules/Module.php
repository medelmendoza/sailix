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
    /** Built into the app (no upstream system, no linking): an organization simply has it or not. */
    case Astra = 'astra';
    /** Built into the app too: incident / safety observation reports (the old "Call-It"). */
    case CallIt = 'callit';

    public function label(): string
    {
        return match ($this) {
            self::Tala => 'Tala',
            self::Astra => 'Astra',
            self::CallIt => 'Call-it',
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

    /** Whether the module talks to an upstream system through the gateway (future modules may not). */
    public function requiresEndpoint(): bool
    {
        return match ($this) {
            self::Tala => true,
            self::Astra => false,
            self::CallIt => false,
        };
    }

    /** Platform setting holding the approved HTTPS origin of the upstream (meaningful when requiresEndpoint()). */
    public function endpointSetting(): string
    {
        return match ($this) {
            self::Tala => 'tala_api_base_url',
            self::Astra, self::CallIt => '', // no upstream: never read (requiresEndpoint() is false)
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

<?php

namespace App\Enums;

/** Font styles an organization can pick. Only fonts every device already has: nothing is downloaded. */
enum FontPreset: string
{
    case Default = 'default';
    case Rounded = 'rounded';
    case Serif = 'serif';
    case System = 'system';

    public function label(): string
    {
        return match ($this) {
            self::Default => 'Default',
            self::Rounded => 'Rounded',
            self::Serif => 'Serif',
            self::System => 'System',
        };
    }
}

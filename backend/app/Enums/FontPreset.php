<?php

namespace App\Enums;

/**
 * Font styles an organization can pick. The first four are fonts every device already has; the rest are web fonts the
 * portal fetches only for an organization that chose them (the mobile app uses its closest installed match).
 */
enum FontPreset: string
{
    case Default = 'default';
    case Rounded = 'rounded';
    case Serif = 'serif';
    case System = 'system';
    case Modern = 'modern';
    case Friendly = 'friendly';
    case Geometric = 'geometric';
    case Playful = 'playful';
    case Elegant = 'elegant';
    case Classic = 'classic';

    public function label(): string
    {
        return match ($this) {
            self::Default => 'Default',
            self::Rounded => 'Rounded',
            self::Serif => 'Serif',
            self::System => 'System',
            self::Modern => 'Modern (Inter)',
            self::Friendly => 'Friendly (Nunito)',
            self::Geometric => 'Geometric (Poppins)',
            self::Playful => 'Playful (Fredoka + Nunito)',
            self::Elegant => 'Elegant (Playfair Display + Lora)',
            self::Classic => 'Classic (Merriweather)',
        };
    }
}

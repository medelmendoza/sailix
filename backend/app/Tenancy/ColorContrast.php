<?php

namespace App\Tenancy;

/** WCAG contrast of a #RRGGBB colour against white (the colour of button text on the brand colours). */
final class ColorContrast
{
    public static function isHex(string $color): bool
    {
        return preg_match('/^#[0-9A-Fa-f]{6}$/', $color) === 1;
    }

    public static function againstWhite(string $hex): float
    {
        $lum = function (int $v): float {
            $c = $v / 255;

            return $c <= 0.03928 ? $c / 12.92 : (($c + 0.055) / 1.055) ** 2.4;
        };
        $r = hexdec(substr($hex, 1, 2));
        $g = hexdec(substr($hex, 3, 2));
        $b = hexdec(substr($hex, 5, 2));
        $l = 0.2126 * $lum((int) $r) + 0.7152 * $lum((int) $g) + 0.0722 * $lum((int) $b);

        return 1.05 / ($l + 0.05);
    }

    /** WCAG contrast ratio between two #RRGGBB colours (1 to 21). */
    public static function between(string $a, string $b): float
    {
        $la = self::luminance($a);
        $lb = self::luminance($b);
        [$hi, $lo] = $la >= $lb ? [$la, $lb] : [$lb, $la];

        return ($hi + 0.05) / ($lo + 0.05);
    }

    private static function luminance(string $hex): float
    {
        $lum = function (int $v): float {
            $c = $v / 255;

            return $c <= 0.03928 ? $c / 12.92 : (($c + 0.055) / 1.055) ** 2.4;
        };

        return 0.2126 * $lum((int) hexdec(substr($hex, 1, 2)))
            + 0.7152 * $lum((int) hexdec(substr($hex, 3, 2)))
            + 0.0722 * $lum((int) hexdec(substr($hex, 5, 2)));
    }
}

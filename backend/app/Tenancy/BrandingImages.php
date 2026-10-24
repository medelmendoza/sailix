<?php

namespace App\Tenancy;

use App\Support\DocumentFiles;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * An organization's logo and favicon. Stored on the private disk under a random name and served only through the
 * public branding endpoint (the sign-in page needs them before anyone is signed in). Only JPEG and PNG are accepted,
 * judged by content (no SVG: it can carry script), resized so many organizations stay cheap to serve, and re-encoded,
 * which also drops metadata such as GPS positions.
 */
final class BrandingImages
{
    private const TYPES = ['image/jpeg' => 'jpg', 'image/png' => 'png'];

    /** Image kind (as in the address) => [column prefix, longest side in pixels]. */
    public const KINDS = [
        'logo' => ['logo', 512],
        'favicon' => ['favicon', 128],
        'login-logo' => ['login_logo', 512],
        'login-background' => ['login_background', 1920],
    ];

    public static function column(string $kind): string
    {
        return self::KINDS[$kind][0];
    }

    /** @return array{path: string, mime: string} */
    public static function store(UploadedFile $file, string $tenantId, string $kind): array
    {
        $mime = (string) $file->getMimeType();
        abort_unless(isset(self::TYPES[$mime]) && isset(self::KINDS[$kind]), 422, 'Use a JPEG or PNG image.');

        // Judge the size from the header BEFORE decoding: a tiny file can unpack to a huge picture (decompression bomb).
        $size = @getimagesize($file->getRealPath());
        abort_if($size === false, 422, 'That image could not be read.');
        abort_if($size[0] * $size[1] > 16_000_000, 422, 'That image is too large.');

        $source = @imagecreatefromstring((string) file_get_contents($file->getRealPath()));
        abort_if($source === false, 422, 'That image could not be read.');

        [$w, $h] = [imagesx($source), imagesy($source)];
        $scale = min(1, self::KINDS[$kind][1] / max($w, $h));
        $image = $scale < 1
            ? imagescale($source, max(1, (int) round($w * $scale)), max(1, (int) round($h * $scale)))
            : $source;

        // A PNG keeps its transparency; anything else is stored as JPEG.
        $png = $mime === 'image/png';
        ob_start();
        if ($png) {
            imagesavealpha($image, true);
            imagepng($image, null, 7);
        } else {
            imagejpeg($image, null, 85);
        }
        $bytes = (string) ob_get_clean();

        $ext = $png ? 'png' : 'jpg';
        $path = "branding/{$tenantId}/{$kind}-".bin2hex(random_bytes(12)).'.'.$ext;
        Storage::disk(DocumentFiles::disk())->put($path, $bytes);

        return ['path' => $path, 'mime' => $png ? 'image/png' : 'image/jpeg'];
    }

    public static function delete(?string $path): void
    {
        if ($path !== null && $path !== '') {
            Storage::disk(DocumentFiles::disk())->delete($path);
        }
    }

    public static function stream(?string $path, ?string $mime): StreamedResponse
    {
        abort_if($path === null || $mime === null, 404);
        $disk = Storage::disk(DocumentFiles::disk());
        abort_unless($disk->exists($path), 404);

        return $disk->response($path, basename($path), [
            'Content-Type' => $mime,
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'public, max-age=3600',
            'Content-Security-Policy' => "default-src 'none'; sandbox",
        ], 'inline');
    }
}

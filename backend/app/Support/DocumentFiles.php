<?php

namespace App\Support;

use App\Models\CallItReport;
use App\Models\CrewDocument;
use App\Support\Settings\SettingsRegistry;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The only code that touches stored document files. Files live on a PRIVATE disk (never web-served) under a random
 * name; the type is decided by what the file really is, and every read goes through an ownership-checked endpoint.
 */
final class DocumentFiles
{
    /** What may be stored, by the content the server detected (never by the client's file name or declared type). */
    private const TYPES = ['application/pdf' => 'pdf', 'image/jpeg' => 'jpg', 'image/png' => 'png'];

    public static function disk(): string
    {
        return (string) config('sailix.documents.disk', 'local');
    }

    /** Maximum upload size in KB for the organization (Laravel's `max` rule takes KB). */
    public static function maxKilobytes(): int
    {
        return ((int) SettingsRegistry::tenant('upload_max_mb')) * 1024;
    }

    /**
     * @return array{file_disk: string, file_path: string, file_original_name: string, file_mime: string, file_size: int}
     */
    public static function store(UploadedFile $file, string $tenantId, string $folder = 'documents'): array
    {
        $mime = (string) $file->getMimeType(); // detected from the content
        $ext = self::TYPES[$mime] ?? null;
        abort_if($ext === null, 422, 'Unsupported file type.');

        $path = "{$folder}/{$tenantId}/".bin2hex(random_bytes(16)).'.'.$ext;
        Storage::disk(self::disk())->putFileAs(dirname($path), $file, basename($path));

        return [
            'file_disk' => self::disk(),
            'file_path' => $path,
            // Only ever shown back as text; control characters and path parts are removed.
            'file_original_name' => mb_substr(preg_replace('/[\x00-\x1f\x7f\/\\\\]/u', '', $file->getClientOriginalName()) ?? 'document', 0, 150) ?: 'document',
            'file_mime' => $mime,
            'file_size' => (int) $file->getSize(),
        ];
    }

    public static function delete(CrewDocument|CallItReport $document): void
    {
        if ($document->file_disk !== null && $document->file_path !== null) {
            Storage::disk($document->file_disk)->delete($document->file_path);
        }
    }

    public static function stream(CrewDocument|CallItReport $document): StreamedResponse
    {
        abort_if($document->file_disk === null || $document->file_path === null || $document->file_mime === null, 404);
        $disk = Storage::disk($document->file_disk);
        abort_unless($disk->exists($document->file_path), 404);
        $ext = self::TYPES[$document->file_mime] ?? 'bin';

        return $disk->response($document->file_path, 'document.'.$ext, [
            'Content-Type' => $document->file_mime,
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
            'Content-Security-Policy' => "default-src 'none'; sandbox",
        ], 'inline');
    }
}

<?php

namespace App\Http\Requests\Tenant;

use App\Support\DocumentFiles;
use Illuminate\Foundation\Http\FormRequest;

class AnnouncementAttachmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // enforced by the announcements.manage ability in the controller
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        // The real type is decided from the file's content when it is stored; this only bounds the size.
        return ['file' => ['required', 'file', 'max:'.DocumentFiles::maxKilobytes()]];
    }
}

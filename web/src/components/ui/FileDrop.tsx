import {
  FileImage,
  FileSpreadsheet,
  FileText,
  UploadCloud,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useId, useState, type DragEvent, type ReactNode } from 'react';
import { cn } from './cn';

/** "812 KB" or "2.4 MB". */
export function fileSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** The round-cornered tile that leads a file: an icon and a colour by kind of file. */
export function FileTile({ contentType, name }: { contentType: string; name?: string }) {
  let Icon: LucideIcon = FileText;
  let tone = 'from-brand-600 to-brand-800';
  if (contentType.startsWith('image/')) {
    Icon = FileImage;
    tone = 'from-accent-500 to-accent-600';
  } else if (
    contentType.includes('csv') ||
    contentType.includes('spreadsheet') ||
    name?.endsWith('.csv')
  ) {
    Icon = FileSpreadsheet;
    tone = 'from-accent-500 to-accent-600';
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm',
        tone,
      )}
    >
      <Icon className="size-5" />
    </span>
  );
}

/** Drag-and-drop handlers for anything that takes dropped files: `over` is true while a file is held above it. */
function useFileDrop(onFiles: (files: File[]) => void, disabled = false) {
  const [over, setOver] = useState(false);
  return {
    over,
    bind: {
      onDragOver: (e: DragEvent) => {
        if (disabled) return;
        e.preventDefault();
        setOver(true);
      },
      onDragLeave: () => setOver(false),
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        setOver(false);
        const files = Array.from(e.dataTransfer.files ?? []);
        if (!disabled && files.length > 0) onFiles(files);
      },
    },
  };
}

/** The empty state of a file picker: a dashed zone that takes a dropped file or opens the chooser. */
export function DropZone({
  id: given,
  accept,
  onFiles,
  title,
  hint,
  disabled,
}: {
  id?: string;
  accept: string;
  onFiles: (files: File[]) => void;
  title?: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
}) {
  const own = useId();
  const id = given ?? own;
  const { over, bind } = useFileDrop(onFiles, disabled);
  return (
    <label
      htmlFor={id}
      {...bind}
      className={cn(
        'flex flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-7 text-center transition focus-within:ring-2 focus-within:ring-brand-600',
        disabled
          ? 'cursor-not-allowed opacity-60'
          : over
            ? 'cursor-copy border-brand-600 bg-brand-50'
            : 'cursor-pointer border-line bg-page/60 hover:border-brand-600/60 hover:bg-brand-50/50',
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-sm"
      >
        <UploadCloud className="size-6" />
      </span>
      <span className="text-sm font-semibold">
        {title ?? (
          <>
            Drop a file here, or <span className="text-brand-700 underline">browse</span>
          </>
        )}
      </span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
      <input
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length > 0) onFiles(files);
        }}
      />
    </label>
  );
}

/**
 * Where a file is dropped or chosen; once chosen it shows the file as a card (kind tile, name, size) with a way to take
 * it back. The caller keeps the file and checks it.
 */
export function FileDrop({
  id,
  file,
  onFile,
  accept,
  hint,
}: {
  id?: string;
  file: File | null;
  onFile: (file: File | null) => void;
  accept: string;
  hint: ReactNode;
}) {
  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
        <FileTile contentType={file.type || 'application/octet-stream'} name={file.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-5">{file.name}</p>
          <p className="text-xs leading-4 text-muted">{fileSize(file.size)}</p>
        </div>
        <button
          type="button"
          onClick={() => onFile(null)}
          title="Choose a different file"
          aria-label="Remove the chosen file"
          className="rounded-full p-2 text-muted transition-colors hover:bg-brand-50 hover:text-brand-800"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    );
  }
  return (
    <DropZone id={id} accept={accept} hint={hint} onFiles={(files) => onFile(files[0] ?? null)} />
  );
}

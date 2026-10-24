import * as AlertDialog from '@radix-ui/react-alert-dialog';
import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { Button } from './Button';

// Above the sticky page header (z-30) and its menus (z-40). The backdrop is the scroll area and the panel sits in it with auto
// margins: centred when it fits, and when it is taller than the window the page of the dialog scrolls (nothing is cut off).
// The panel is not moved with a transform, so a picker inside it can still be positioned from the window.
const OVERLAY = 'fixed inset-0 z-50 flex overflow-y-auto bg-black/40 p-4';
const PANEL = 'relative m-auto w-[min(32rem,100%)] rounded-lg bg-surface p-6 shadow-xl';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmation for state-changing/destructive actions (focus is trapped and restored by Radix). */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive,
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={OVERLAY}>
          <AlertDialog.Content className={PANEL}>
            <AlertDialog.Title className="text-lg font-semibold">{title}</AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm text-muted">
              {description}
            </AlertDialog.Description>
            <div className="mt-6 flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <Button variant="secondary">Cancel</Button>
              </AlertDialog.Cancel>
              <Button
                variant={destructive ? 'danger' : 'primary'}
                loading={loading}
                onClick={onConfirm}
              >
                {confirmLabel}
              </Button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Overlay>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

interface FormDialogProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}

/** Modal that hosts a form (the form renders its own submit/cancel buttons). */
export function FormDialog({ open, title, description, onClose, children }: FormDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={OVERLAY}>
          <Dialog.Content className={PANEL} aria-describedby={description ? undefined : undefined}>
            <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
            {description ? (
              <Dialog.Description className="mt-1 text-sm text-muted">
                {description}
              </Dialog.Description>
            ) : (
              <Dialog.Description className="sr-only">{title}</Dialog.Description>
            )}
            <div className="mt-4">{children}</div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

import { create } from 'zustand';
import type { PickedFile } from '@/features/files/api';

/**
 * Hands the finished scan (a PDF in the cache) from the scanner screen back to the form that asked for it. A route
 * parameter cannot carry a file safely, and the form reads it once when it is shown again.
 */
type State = {
  file: PickedFile | null;
  put: (file: PickedFile) => void;
  take: () => PickedFile | null;
};

export const useScanStore = create<State>((set, get) => ({
  file: null,
  put: (file) => set({ file }),
  take: () => {
    const f = get().file;
    if (f) set({ file: null });
    return f;
  },
}));

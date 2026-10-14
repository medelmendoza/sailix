/** The pages of a scan, as a small pure model (spec DOC-07: at most five pages, camera or library, a PDF at the end). */
export const MAX_PAGES = 5;

export type Page = { id: string; uri: string };

export function addPages(
  pages: readonly Page[],
  uris: readonly string[],
  newId: () => string,
): Page[] {
  const room = Math.max(0, MAX_PAGES - pages.length);
  return [...pages, ...uris.slice(0, room).map((uri) => ({ id: newId(), uri }))];
}

export const removePage = (pages: readonly Page[], id: string): Page[] =>
  pages.filter((p) => p.id !== id);

/** Moves one page `by` places (-1 earlier, +1 later); out-of-range moves leave the order alone. */
export function movePage(pages: readonly Page[], id: string, by: -1 | 1): Page[] {
  const i = pages.findIndex((p) => p.id === id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= pages.length) return [...pages];
  const next = [...pages];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

export const roomLeft = (pages: readonly Page[]) => Math.max(0, MAX_PAGES - pages.length);

/**
 * One US-Letter page per picture, the picture centred and never stretched. The pictures are inlined as base64 because the
 * print engine cannot read local file addresses on iOS.
 */
export function pdfHtml(base64Jpegs: readonly string[]): string {
  const pages = base64Jpegs
    .map((b64) => `<div class="page"><img src="data:image/jpeg;base64,${b64}" /></div>`)
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8" /><style>
@page { margin: 0; }
html, body { margin: 0; padding: 0; }
.page { width: 612px; height: 792px; display: flex; align-items: center; justify-content: center; page-break-after: always; overflow: hidden; }
.page:last-child { page-break-after: auto; }
img { max-width: 100%; max-height: 100%; object-fit: contain; }
</style></head><body>${pages}</body></html>`;
}

/** `scan-2026-10-14-1530.pdf`: a readable name; the server decides the stored name anyway. */
export function scanName(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `scan-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.pdf`;
}

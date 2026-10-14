import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as Print from 'expo-print';
import type { PickedFile } from '@/features/files/api';
import { pdfHtml, scanName, type Page } from './pages';

/** A page is shrunk to this width before it goes into the PDF: sharp enough to read, small enough to upload. */
const PAGE_WIDTH = 1600;

async function toBase64Jpeg(uri: string): Promise<string> {
  const image = await ImageManipulator.manipulate(uri)
    .resize({ width: PAGE_WIDTH, height: null })
    .renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  if (!saved.base64) throw new Error('A page could not be prepared.');
  return saved.base64;
}

/** Makes one PDF of the pages, in order. The page pictures are deleted afterwards: a scan is personal data. */
export async function buildPdf(pages: readonly Page[]): Promise<PickedFile> {
  const pictures: string[] = [];
  for (const p of pages) pictures.push(await toBase64Jpeg(p.uri)); // one at a time: five full photos at once is a lot of memory
  const { uri } = await Print.printToFileAsync({
    html: pdfHtml(pictures),
    width: 612,
    height: 792,
  });
  discard(pages.map((p) => p.uri));

  return { uri, name: scanName(), mimeType: 'application/pdf' };
}

/** Best-effort removal of temporary scan files. */
export function discard(uris: readonly string[]): void {
  for (const uri of uris) {
    try {
      const f = new File(uri);
      if (f.exists) f.delete();
    } catch {
      // the system clears its cache anyway
    }
  }
}

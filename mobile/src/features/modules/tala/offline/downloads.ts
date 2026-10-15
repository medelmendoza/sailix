import { Directory, File, Paths } from 'expo-file-system';
import { fetchTalaMaterial } from '../api';
import { assertSafeSegment, currentScope, ROOT_DIR_NAME } from './paths';
import { getDownloads, putDownload, removeDownloadRecord, type DownloadRecord } from './store';

/**
 * Downloads a video or PDF for offline use. The address comes from the Sailix gateway (https only); each material gets
 * its own folder so file names from the server can never collide or escape the app's directory.
 */
export type DownloadOptions = {
  /** Bytes written so far and the total (`-1` when the server does not say). */
  onProgress?: (p: { bytesWritten: number; totalBytes: number }) => void;
  /** Aborting stops the transfer; nothing is kept. */
  signal?: AbortSignal;
};

export async function downloadMaterial(
  assignId: string,
  material: { id: string; type: 'video' | 'pdf'; name: string },
  options: DownloadOptions = {},
): Promise<DownloadRecord> {
  const scope = currentScope();
  const id = assertSafeSegment(material.id);
  const detail = await fetchTalaMaterial(assignId, id);
  if (!detail.file_url) throw new Error('This item has no file to download.');

  const root = new Directory(Paths.document, ROOT_DIR_NAME);
  const scopeDir = new Directory(Paths.document, ROOT_DIR_NAME, scope);
  const target = new Directory(Paths.document, ROOT_DIR_NAME, scope, id);
  for (const dir of [root, scopeDir, target]) if (!dir.exists) dir.create();

  let file: File;
  try {
    const task = File.createDownloadTask(detail.file_url, target, {
      onProgress: options.onProgress,
      signal: options.signal,
    });
    const done = await task.downloadAsync();
    if (!done) throw new Error('The download did not finish.');
    file = done;
  } catch (e) {
    if (target.exists) target.delete(); // never keep a half-written download
    throw e;
  }
  const record: DownloadRecord = {
    materialId: id,
    assignId,
    type: material.type,
    name: material.name,
    uri: file.uri,
    bytes: file.size,
    downloadedAt: new Date().toISOString(),
  };
  await putDownload(scope, record);
  return record;
}

/** Remembers that the saved file was opened (a PDF can be marked completed only after it has been opened). */
export async function markOpened(materialId: string): Promise<void> {
  const scope = currentScope();
  const rec = (await getDownloads(scope))[assertSafeSegment(materialId)];
  if (!rec || rec.openedAt) return;
  await putDownload(scope, { ...rec, openedAt: new Date().toISOString() });
}

export async function deleteDownload(materialId: string): Promise<void> {
  const scope = currentScope();
  const dir = new Directory(Paths.document, ROOT_DIR_NAME, scope, assertSafeSegment(materialId));
  if (dir.exists) dir.delete();
  await removeDownloadRecord(scope, materialId);
}

/** Download records whose file is still on disk (the OS may clear storage under pressure). */
export async function listDownloads(): Promise<Record<string, DownloadRecord>> {
  const scope = currentScope();
  const all = await getDownloads(scope);
  const alive: Record<string, DownloadRecord> = {};
  for (const [id, rec] of Object.entries(all)) {
    if (new File(rec.uri).exists) alive[id] = rec;
  }
  return alive;
}

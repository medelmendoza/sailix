import { Directory, File, Paths } from 'expo-file-system';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api/client';
import type {
  CrewDocument,
  DocumentRequestItem,
  DocumentType,
  Envelope,
  MemberDocumentList,
} from '@/services/api/types';
import { useSessionStore } from '@/store/sessionStore';
import { scopedKey } from '@/store/scopedKey';

export type DocumentView = 'approved' | 'review';

export function useDocuments(view: DocumentView, enabled = true) {
  return useQuery({
    queryKey: scopedKey('documents', 'list', view),
    enabled,
    queryFn: async () =>
      (await api.get<MemberDocumentList>('/documents', { params: { status: view } })).data,
  });
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: scopedKey('documents', 'one', id),
    enabled: id !== '', // the add form has no document yet
    queryFn: async () => (await api.get<Envelope<CrewDocument>>(`/documents/${id}`)).data.data,
  });
}

/** What the agency asked this member to submit or renew. It shrinks by itself once they send the document in. */
export function useDocumentRequests() {
  return useQuery({
    queryKey: scopedKey('documents', 'requests'),
    queryFn: async () =>
      (await api.get<Envelope<DocumentRequestItem[]>>('/document-requests')).data.data,
  });
}

export function useDocumentTypes() {
  return useQuery({
    queryKey: scopedKey('documents', 'types'),
    queryFn: async () => (await api.get<Envelope<DocumentType[]>>('/document-types')).data.data,
  });
}

export type DocumentFields = {
  document_type_id: string;
  number: string;
  grade: string;
  location: string;
  school: string;
  issued_on: string;
  expires_on: string;
};
export type PickedFile = { uri: string; name: string; mimeType: string };

/** Builds the multipart body. Empty optional fields are still sent so a correction can clear them. */
export function buildDocumentForm(
  fields: Partial<DocumentFields>,
  file: PickedFile | null,
): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) form.append(key, value);
  }
  // React Native's FormData takes a {uri, name, type} descriptor in place of a Blob
  if (file) form.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as never);
  return form;
}

const multipart = {
  headers: { 'Content-Type': 'multipart/form-data' },
  transformRequest: (d: unknown) => d,
};

/** Submits a new document, or resubmits one that is waiting or was sent back. The owner always comes from the session. */
export function useSaveDocument(id?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      fields,
      file,
    }: {
      fields: Partial<DocumentFields>;
      file: PickedFile | null;
    }) => {
      const form = buildDocumentForm(fields, file);
      return (
        await api.post<Envelope<CrewDocument>>(
          id ? `/documents/${id}/resubmit` : '/documents',
          form,
          multipart,
        )
      ).data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: scopedKey('documents') }),
  });
}

/**
 * Downloads a document to a TEMPORARY file in the cache so it can be shown. The request carries the bearer token, the
 * file is never kept (the viewer deletes it on leaving), and nothing is added to the offline store.
 */
export async function downloadToCache(
  id: string,
  source: 'document' | 'callit' | 'announcement' = 'document',
): Promise<File> {
  const token = useSessionStore.getState().credential?.token;
  const base = api.defaults.baseURL ?? '';
  const dir = new Directory(Paths.cache, 'viewing');
  if (!dir.exists) dir.create();
  const target = new Directory(dir, id.replace(/[^A-Za-z0-9-]/g, ''));
  if (target.exists) target.delete();
  target.create();
  const folder = { document: 'documents', callit: 'callit/reports', announcement: 'announcements' }[
    source
  ];
  const path = `/${folder}/${encodeURIComponent(id)}/file`;
  return File.downloadFileAsync(`${base}${path}`, target, {
    headers: token ? { Authorization: `Bearer ${token}`, Accept: '*/*' } : {},
  });
}

export function removeFromCache(id: string): void {
  try {
    const target = new Directory(Paths.cache, 'viewing', id.replace(/[^A-Za-z0-9-]/g, ''));
    if (target.exists) target.delete();
  } catch {
    // best effort
  }
}

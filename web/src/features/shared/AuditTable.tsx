import { Badge, EmptyState, Table, type CellKind } from '../../components/ui';
import type { AuditEntry } from '../../services/api/types';

const ACTOR_LABEL: Record<string, string> = {
  platform_admin: 'Platform admin',
  user: 'User',
  system: 'System',
};

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** The audit table's columns, shared with its loading placeholder so the two always have the same shape. */
export const AUDIT_HEADERS = ['When', 'Action', 'Actor', 'Subject'];
export const AUDIT_CELLS: CellKind[] = ['date', 'mono', 'pill', 'text'];

export function AuditTable({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0)
    return (
      <EmptyState
        title="No activity yet"
        description="Security and administrative events will appear here."
      />
    );
  return (
    <Table caption="Audit log" headers={AUDIT_HEADERS}>
      {entries.map((e) => (
        <tr key={e.id}>
          <td className="whitespace-nowrap px-4 py-3">{formatDateTime(e.created_at)}</td>
          <td className="px-4 py-3 font-mono text-xs">{e.action}</td>
          <td className="px-4 py-3">
            <Badge>{ACTOR_LABEL[e.actor_type] ?? e.actor_type}</Badge>
          </td>
          <td className="px-4 py-3 text-muted">{e.subject_type ?? '—'}</td>
        </tr>
      ))}
    </Table>
  );
}

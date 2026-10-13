import type { ReactNode } from 'react';
import { cn } from './cn';

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const TONES: Record<Tone, string> = {
  neutral: 'bg-page text-muted border border-line',
  success: 'bg-ok-bg text-ok-fg',
  warning: 'bg-warn-bg text-warn-fg',
  danger: 'bg-bad-bg text-bad-fg',
  info: 'bg-accent-100 text-brand-800',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  // Status is always conveyed by the text as well, never by colour alone.
  return (
    <span
      className={cn('inline-block rounded-full px-2.5 py-0.5 text-xs font-medium', TONES[tone])}
    >
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, Tone> = {
  active: 'success',
  enabled: 'success',
  linked: 'success',
  pending: 'warning',
  provisioning: 'warning',
  invited: 'info',
  suspended: 'danger',
  deactivated: 'danger',
  archived: 'neutral',
  disabled: 'neutral',
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONES[status] ?? 'neutral'}>{status.replace('_', ' ')}</Badge>;
}

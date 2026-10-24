import type { LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';
import { cn } from './cn';

type Tone = 'neutral' | 'primary' | 'danger';

// Plain at rest, a soft tint on hover: the same quiet look as the schoolhub row actions.
const TONES: Record<Tone, string> = {
  neutral: 'text-muted hover:bg-brand-50 hover:text-brand-700',
  primary: 'text-brand-700 hover:bg-brand-50 hover:text-brand-800',
  danger: 'text-bad-fg hover:bg-bad-bg hover:text-bad-fg',
};

interface Common {
  icon: LucideIcon;
  /** What a screen reader says: the full action, e.g. "Edit February allotment". */
  label: string;
  /** What the hover shows: the short action, e.g. "Edit". Defaults to the label. */
  tip?: string;
  tone?: Tone;
  className?: string;
}

const BASE =
  'group relative inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-50';

function Face({ icon: Icon, label, tip }: Pick<Common, 'icon' | 'label' | 'tip'>) {
  return (
    <>
      <Icon className="size-[1.125rem] shrink-0" aria-hidden="true" />
      {/* shown above the button on hover and keyboard focus; hidden from screen readers, which have the label */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2.5 py-1.5 text-sm font-medium text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        {tip ?? label}
      </span>
    </>
  );
}

/** A row action drawn as a round icon button; its name appears on hover (and on keyboard focus). */
export function IconButton({
  icon,
  label,
  tip,
  tone = 'neutral',
  className,
  type = 'button',
  ...rest
}: Common & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children'>) {
  return (
    <button
      type={type}
      aria-label={label}
      data-icon // tells a table not to give it the padding of a text button
      className={cn(BASE, TONES[tone], className)}
      {...rest}
    >
      <Face icon={icon} label={label} tip={tip} />
    </button>
  );
}

/** The same, for a row action that goes to another page. */
export function IconLink({
  to,
  icon,
  label,
  tip,
  tone = 'neutral',
  className,
}: Common & { to: string }) {
  return (
    <Link to={to} aria-label={label} className={cn(BASE, TONES[tone], className)}>
      <Face icon={icon} label={label} tip={tip} />
    </Link>
  );
}

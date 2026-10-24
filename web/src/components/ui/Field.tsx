import { Eye, EyeOff } from 'lucide-react';
import { useId, useState } from 'react';
import type {
  InputHTMLAttributes,
  ReactNode,
  Ref,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { cn } from './cn';
import { DatePicker } from './DatePicker';

interface FieldFrameProps {
  label: string;
  error?: string;
  hint?: string;
  id: string;
  children: ReactNode;
}

function FieldFrame({ label, error, hint, id, children }: FieldFrameProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-bad-fg">
          {error}
        </p>
      )}
    </div>
  );
}

const CONTROL =
  'min-h-10 w-full rounded-xl border bg-surface px-3.5 text-sm transition-colors placeholder:text-muted hover:border-brand-600/60 focus:border-brand-600 disabled:bg-page';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  /** A small icon at the left end of the box (sign-in pages). */
  icon?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

export function TextField({
  label,
  error,
  hint,
  icon,
  className,
  ref,
  type,
  ...rest
}: TextFieldProps) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const isPassword = type === 'password';
  const input = (
    <input
      id={id}
      ref={ref}
      type={isPassword && shown ? 'text' : type}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      className={cn(
        CONTROL,
        error ? 'border-bad-fg' : 'border-line',
        isPassword && 'pr-11',
        icon ? 'pl-10' : null,
        className,
      )}
      {...rest}
    />
  );
  return (
    <FieldFrame label={label} error={error} hint={hint} id={id}>
      {isPassword || icon ? (
        // every password box can be shown and hidden again, with the same small eye at its right end
        <div className="relative">
          {icon && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-muted [&>svg]:size-4"
            >
              {icon}
            </span>
          )}
          {input}
          {isPassword && (
            <button
              type="button"
              aria-label={shown ? 'Hide password' : 'Show password'}
              aria-pressed={shown}
              title={shown ? 'Hide password' : 'Show password'}
              onClick={() => setShown((v) => !v)}
              className="absolute inset-y-0 right-1 my-auto flex size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-brand-50 hover:text-brand-800"
            >
              {shown ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </button>
          )}
        </div>
      ) : (
        input
      )}
    </FieldFrame>
  );
}

interface DateFieldProps {
  label: string;
  /** `YYYY-MM-DD`, or empty. */
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  hint?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
}

/** A labelled date box with the calendar picker. Controlled: the value is `YYYY-MM-DD` or empty. */
export function DateField({
  label,
  value,
  onChange,
  onBlur,
  error,
  hint,
  disabled,
  min,
  max,
}: DateFieldProps) {
  const id = useId();
  return (
    <FieldFrame label={label} error={error} hint={hint} id={id}>
      <DatePicker
        id={id}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        disabled={disabled}
        min={min}
        max={max}
        invalid={!!error}
        describedBy={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      />
    </FieldFrame>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
  ref?: Ref<HTMLSelectElement>;
}

export function SelectField({ label, error, options, className, ref, ...rest }: SelectFieldProps) {
  const id = useId();
  return (
    <FieldFrame label={label} error={error} id={id}>
      <select
        id={id}
        ref={ref}
        aria-invalid={error ? true : undefined}
        className={cn(CONTROL, error ? 'border-bad-fg' : 'border-line', className)}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldFrame>
  );
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
  ref?: Ref<HTMLTextAreaElement>;
}

export function TextAreaField({ label, error, hint, className, ref, ...rest }: TextAreaFieldProps) {
  const id = useId();
  return (
    <FieldFrame label={label} error={error} hint={hint} id={id}>
      <textarea
        id={id}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cn(CONTROL, 'min-h-28 py-2', error ? 'border-bad-fg' : 'border-line', className)}
        {...rest}
      />
    </FieldFrame>
  );
}

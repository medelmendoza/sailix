const formatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Backend sends numbers as number or string, sometimes empty/null. */
export function parseAmount(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/,/g, '').trim();
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** `#,##0.00`, or null when the value is missing/unparseable (callers hide the row; never crash). */
export function formatAmount(value: unknown): string | null {
  const n = parseAmount(value);
  return n === null ? null : formatter.format(n);
}

/** `$` when the record is dollar-denominated (`is_dollar === 'Y'`), otherwise `₱`. */
export function formatMoney(value: unknown, isDollar: boolean): string | null {
  const amount = formatAmount(value);
  return amount === null ? null : `${isDollar ? '$' : '₱'} ${amount}`;
}

/** Share of a loan already paid, 0-100; null when the loan amount is zero/invalid. */
export function paidPercent(loanAmount: unknown, paidAmount: unknown): number | null {
  const loan = parseAmount(loanAmount);
  const paid = parseAmount(paidAmount);
  if (loan === null || paid === null || loan === 0) return null;
  return (paid / loan) * 100;
}

/** Mask all but the last `visible` characters (bank account numbers — SR-09). */
export function maskAccount(value: string, visible = 4): string {
  const trimmed = value.trim();
  if (trimmed.length <= visible) return trimmed;
  return `${'•'.repeat(trimmed.length - visible)}${trimmed.slice(-visible)}`;
}

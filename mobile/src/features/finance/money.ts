/**
 * Money is the SERVER's own value, shown as it arrives (spec BR-48): a decimal string like "19000.00". It is only
 * grouped for reading ("19,000.00") and never parsed to a number, so no rounding can creep in.
 */
export function formatMoney(value: string | null | undefined, dollar: boolean): string | null {
  if (value === null || value === undefined || value.trim() === '') return null;
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!m) return null; // not a number: hide it rather than show garbage
  const [, sign, whole, fraction = ''] = m;
  const grouped = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}${dollar ? '$' : '₱'}${grouped}.${(fraction + '00').slice(0, 2)}`;
}

/** Share of a loan already paid, 0 to 100, ONLY for choosing a colour (spec BR-45); the amounts shown stay the server's. */
export function paidPercent(loanAmount: string, paidAmount: string): number | null {
  const loan = Number(loanAmount);
  const paid = Number(paidAmount);
  if (!Number.isFinite(loan) || !Number.isFinite(paid) || loan <= 0) return null;
  return Math.max(0, Math.min(100, (paid / loan) * 100));
}

export type LoanHealth = 'behind' | 'progressing' | 'healthy' | 'neutral';

export function loanHealth(loanAmount: string, paidAmount: string): LoanHealth {
  const p = paidPercent(loanAmount, paidAmount);
  if (p === null) return 'neutral';
  if (p < 50) return 'behind';
  if (p < 80) return 'progressing';
  return 'healthy';
}

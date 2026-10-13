import { formatMoney, loanHealth, paidPercent } from '../money';

describe('formatMoney (the server value, only grouped for reading)', () => {
  it('groups thousands and keeps two places, with the currency of the payslip', () => {
    expect(formatMoney('19000.00', false)).toBe('₱19,000.00');
    expect(formatMoney('1234567.5', true)).toBe('$1,234,567.50');
    expect(formatMoney('0.05', false)).toBe('₱0.05');
    expect(formatMoney('-1500.00', false)).toBe('-₱1,500.00');
    expect(formatMoney('12', false)).toBe('₱12.00');
  });

  it('never rounds: extra places are cut, not rounded', () => {
    expect(formatMoney('10.999', false)).toBe('₱10.99');
  });

  it('hides a missing or unreadable figure instead of showing zero or garbage', () => {
    for (const v of [null, undefined, '', '  ', 'abc', '12,5', '1e5'])
      expect(formatMoney(v, false)).toBeNull();
  });
});

describe('loan colour (only the colour comes from the percentage)', () => {
  it('is red under half, orange under 80 percent, green after, neutral without a loan amount', () => {
    expect(loanHealth('1000.00', '400.00')).toBe('behind');
    expect(loanHealth('1000.00', '500.00')).toBe('progressing');
    expect(loanHealth('1000.00', '799.99')).toBe('progressing');
    expect(loanHealth('1000.00', '800.00')).toBe('healthy');
    expect(loanHealth('0.00', '0.00')).toBe('neutral');
    expect(loanHealth('x', '1')).toBe('neutral');
  });

  it('keeps the percentage within 0 to 100', () => {
    expect(paidPercent('100.00', '250.00')).toBe(100);
    expect(paidPercent('100.00', '-5.00')).toBe(0);
  });
});

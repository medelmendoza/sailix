import { formatAmount, formatMoney, maskAccount, paidPercent, parseAmount } from '../money';

describe('money', () => {
  it('parses numbers and strings defensively', () => {
    expect(parseAmount(12.5)).toBe(12.5);
    expect(parseAmount('1,234.50')).toBe(1234.5);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount(null)).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });

  it('formats #,##0.00 and never throws on empty values', () => {
    expect(formatAmount('1234567.891')).toBe('1,234,567.89');
    expect(formatAmount(0)).toBe('0.00');
    expect(formatAmount('')).toBeNull();
  });

  it('uses $ for dollar records and ₱ otherwise', () => {
    expect(formatMoney(1500, true)).toBe('$ 1,500.00');
    expect(formatMoney('1500', false)).toBe('₱ 1,500.00');
    expect(formatMoney(undefined, false)).toBeNull();
  });

  it('computes paid percent and guards a zero loan amount', () => {
    expect(paidPercent('1000', '250')).toBe(25);
    expect(paidPercent(0, 10)).toBeNull();
    expect(paidPercent('x', 10)).toBeNull();
  });

  it('masks all but the last four characters', () => {
    expect(maskAccount('1234567890')).toBe('••••••7890');
    expect(maskAccount('123')).toBe('123');
  });
});

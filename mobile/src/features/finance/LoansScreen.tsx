import { ScrollView, StyleSheet, View } from 'react-native';
import { AppText, Card, EmptyState, ErrorState, ProgressBar, SkeletonList } from '@/components';
import { colors, spacing } from '@/constants/theme';
import { describeError } from '@/services/api/errors';
import { useLoans } from './api';
import { formatMoney, loanHealth, paidPercent } from './money';

const HEALTH = {
  behind: colors.danger,
  progressing: colors.warning,
  healthy: colors.success,
  neutral: colors.textMuted,
} as const;

export function LoansScreen() {
  const loans = useLoans();
  if (loans.isError)
    return <ErrorState message={describeError(loans.error)} onRetry={() => void loans.refetch()} />;
  if (!loans.data) return <SkeletonList />;
  const { data, totals } = loans.data;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card style={styles.card}>
        <AppText variant="heading" accessibilityRole="header">
          Still being deducted
        </AppText>
        <View style={styles.line}>
          <AppText muted>In pesos</AppText>
          <AppText variant="heading">{formatMoney(totals.php, false)}</AppText>
        </View>
        <View style={styles.line}>
          <AppText muted>In dollars</AppText>
          <AppText variant="heading">{formatMoney(totals.usd, true)}</AppText>
        </View>
      </Card>
      {data.length === 0 ? (
        <EmptyState title="No cash advances" description="You have no cash advances on record." />
      ) : (
        data.map((l) => {
          const health = loanHealth(l.loan_amount, l.paid_amount);
          const pct = paidPercent(l.loan_amount, l.paid_amount);
          return (
            <Card key={l.id} style={styles.card}>
              <AppText variant="heading">{l.description}</AppText>
              <AppText variant="caption" muted>
                {l.code}
                {l.is_stopped ? ' · Deduction stopped' : ''}
              </AppText>
              {pct !== null ? (
                <ProgressBar percent={pct} label={`${l.description} paid`} color={HEALTH[health]} />
              ) : null}
              <View style={styles.line}>
                <AppText muted>Borrowed</AppText>
                <AppText>{formatMoney(l.loan_amount, l.is_dollar)}</AppText>
              </View>
              <View style={styles.line}>
                <AppText muted>Paid</AppText>
                <AppText>{formatMoney(l.paid_amount, l.is_dollar)}</AppText>
              </View>
              <View style={styles.line}>
                <AppText muted>Each deduction</AppText>
                <AppText>{formatMoney(l.deduct_amount, l.is_dollar)}</AppText>
              </View>
              <View style={styles.line}>
                <AppText muted>Balance</AppText>
                <AppText variant="heading" style={{ color: HEALTH[health] }}>
                  {formatMoney(l.balance, l.is_dollar)}
                </AppText>
              </View>
              {l.remarks ? (
                <AppText variant="caption" muted>
                  {l.remarks}
                </AppText>
              ) : null}
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  card: { gap: spacing.sm },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
});

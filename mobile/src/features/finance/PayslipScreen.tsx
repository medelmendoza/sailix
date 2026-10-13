import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { AppStackParamList } from '@/app/navigation/types';
import { AppText, Card, ErrorState, SkeletonList } from '@/components';
import { spacing } from '@/constants/theme';
import { describeError, toApiError } from '@/services/api/errors';
import { needsUnlock, usePayslip } from './api';
import { formatMoney } from './money';
import { UnlockForm } from './UnlockForm';

type Props = NativeStackScreenProps<AppStackParamList, 'Payslip'>;

function Line({
  label,
  value,
  strong,
}: {
  label: string;
  value?: string | null;
  strong?: boolean;
}) {
  if (!value) return null; // an empty or missing figure is hidden, never shown as zero or garbage
  return (
    <View style={styles.line}>
      <AppText muted={!strong} style={{ flex: 1 }}>
        {label}
      </AppText>
      <AppText variant={strong ? 'heading' : 'body'}>{value}</AppText>
    </View>
  );
}

export function PayslipScreen({ route }: Props) {
  const one = usePayslip(route.params.id);

  if (one.isError && needsUnlock(one.error)) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <UnlockForm />
      </ScrollView>
    );
  }
  if (one.isError) {
    const gone = toApiError(one.error).status === 404;
    return (
      <ErrorState
        message={gone ? 'This payslip is no longer available.' : describeError(one.error)}
        onRetry={gone ? undefined : () => void one.refetch()}
      />
    );
  }
  const p = one.data;
  if (!p) return <SkeletonList />;
  const m = (v?: string | null) => formatMoney(v, p.is_dollar);
  const usd = (v?: string | null) => formatMoney(v, true);
  const peso = (v?: string | null) => formatMoney(v, false);
  const hasDeductions = p.deductions.length > 0 || !!p.employee_sss;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <AppText variant="title" accessibilityRole="header">
        {p.period_label}
      </AppText>
      <Card style={styles.card}>
        <Line label="Vessel" value={p.full_vessel_name ?? p.vessel_name} />
        <Line label="Position" value={p.position} />
        <Line label="Payee" value={p.payee_name} />
        <Line
          label="Bank"
          value={[p.bank_code, p.account_number].filter(Boolean).join(' ') || null}
        />
        <Line label="Departed" value={p.depart_date} />
        <Line label="Payroll date" value={p.payroll_date} />
      </Card>
      <Card style={styles.card}>
        <Line label="Pay in dollars" value={usd(p.pay_usd)} />
        <Line label="Exchange rate" value={p.exchange_rate} />
        <Line label="Pay in pesos" value={peso(p.pay_peso)} />
        <Line label={p.adjustment_detail || 'Adjustment'} value={m(p.adjustment)} />
        <Line label="Sign-on adjustment" value={m(p.signon_adjustment)} />
        <Line label="Union dues" value={m(p.union_dues)} />
        <Line label="Withholding tax" value={m(p.withholding_tax)} />
        <Line label="Bank charges" value={m(p.bank_charges)} />
        <Line label="Management fee" value={m(p.mpfee)} />
      </Card>
      {hasDeductions ? (
        <Card style={styles.card}>
          <AppText variant="heading">Deductions</AppText>
          <Line label="SSS" value={peso(p.employee_sss)} />
          <Line label="PhilHealth" value={peso(p.employee_philhealth)} />
          <Line label="Pag-IBIG" value={peso(p.employee_pagibig)} />
          <Line label="SSS, PhilHealth and Pag-IBIG together" value={peso(p.sss_total)} />
          {p.deductions.map((d, i) => (
            <Line key={`${d.description}-${i}`} label={d.description} value={m(d.amount)} />
          ))}
          <Line label="Total deductions" value={m(p.deductions_total)} strong />
        </Card>
      ) : null}
      <Card style={styles.card}>
        <Line label="Net amount" value={m(p.net_amount)} strong />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  card: { gap: spacing.sm },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});

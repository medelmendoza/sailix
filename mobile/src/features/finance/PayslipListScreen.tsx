import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { AppStackParamList } from '@/app/navigation/types';
import { AppText, Button, Card, EmptyState, ErrorState, SkeletonList } from '@/components';
import { minTouchTarget, spacing } from '@/constants/theme';
import { describeError } from '@/services/api/errors';
import { needsUnlock, usePayslips } from './api';
import { formatMoney } from './money';
import { UnlockForm } from './UnlockForm';

type Props = NativeStackScreenProps<AppStackParamList, 'PayslipList'>;

export function PayslipListScreen({ route, navigation }: Props) {
  const { kind } = route.params;
  const list = usePayslips(kind);
  const [oldestFirst, setOldestFirst] = useState(false);

  if (list.isError && needsUnlock(list.error)) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <UnlockForm />
      </ScrollView>
    );
  }
  if (list.isError)
    return <ErrorState message={describeError(list.error)} onRetry={() => void list.refetch()} />;
  if (!list.data) return <SkeletonList />;

  const rows = oldestFirst ? [...list.data].reverse() : list.data; // the server sends newest first
  if (rows.length === 0) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <EmptyState title="No payslips" description="Payslips released to you will appear here." />
      </ScrollView>
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Button
        title={oldestFirst ? 'Showing oldest first' : 'Showing newest first'}
        variant="secondary"
        onPress={() => setOldestFirst((x) => !x)}
      />
      {rows.map((p) => (
        <Pressable
          key={p.id}
          accessibilityRole="button"
          accessibilityLabel={`${p.period_label}, ${p.vessel_name}`}
          onPress={() => navigation.navigate('Payslip', { id: p.id })}
          style={({ pressed }) => [styles.press, pressed && { opacity: 0.75 }]}
        >
          <Card style={styles.card}>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="heading">{p.period_label}</AppText>
              <AppText muted>{p.vessel_name}</AppText>
              <AppText variant="caption" muted>
                {p.kind === 'special' ? 'Special · ' : ''}
                {p.pay_date}
              </AppText>
            </View>
            <AppText variant="heading">{formatMoney(p.net_amount, p.is_dollar)}</AppText>
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  press: { minHeight: minTouchTarget },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});

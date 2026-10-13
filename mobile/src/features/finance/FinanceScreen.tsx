import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { AppStackParamList, MainTabParamList } from '@/app/navigation/types';
import { AppText, Card } from '@/components';
import { minTouchTarget, radius, spacing } from '@/constants/theme';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Finance'>,
  NativeStackScreenProps<AppStackParamList>
>;

export function FinanceScreen({ navigation }: Props) {
  const items = [
    {
      title: 'Allotment',
      note: 'Your monthly and special pay. Asks for your password.',
      go: () => navigation.navigate('PayslipList', { kind: 'allotment' }),
    },
    {
      title: 'Final pay',
      note: 'Your pay at the end of a contract. Asks for your password.',
      go: () => navigation.navigate('PayslipList', { kind: 'final' }),
    },
    {
      title: 'Cash advance',
      note: 'What you borrowed and what is left to pay.',
      go: () => navigation.navigate('Loans'),
    },
  ];
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <AppText variant="title" accessibilityRole="header">
        Finance
      </AppText>
      {items.map((i) => (
        <Pressable
          key={i.title}
          accessibilityRole="button"
          accessibilityLabel={i.title}
          onPress={i.go}
          style={({ pressed }) => [styles.press, pressed && { opacity: 0.75 }]}
        >
          <Card style={styles.card}>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="heading">{i.title}</AppText>
              <AppText variant="caption" muted>
                {i.note}
              </AppText>
            </View>
            <AppText muted>›</AppText>
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  press: { minHeight: minTouchTarget },
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md },
});

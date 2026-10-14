import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { AppStackParamList, MainTabParamList } from '@/app/navigation/types';
import { AppText, GlyphIcon, type GlyphName } from '@/components';
import { minTouchTarget, spacing } from '@/constants/theme';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Finance'>,
  NativeStackScreenProps<AppStackParamList>
>;

export function FinanceScreen({ navigation }: Props) {
  const items = [
    {
      title: 'Allotment',
      glyph: 'chart' as GlyphName,
      gradient: 'linear-gradient(135deg, #355DAD 0%, #2A7F8F 100%)',
      note: 'Your monthly and special pay. Asks for your password.',
      go: () => navigation.navigate('PayslipList', { kind: 'allotment' }),
    },
    {
      title: 'Final pay',
      glyph: 'medal' as GlyphName,
      gradient: 'linear-gradient(135deg, #2A7F8F 0%, #2E8B6A 100%)',
      note: 'Your pay at the end of a contract. Asks for your password.',
      go: () => navigation.navigate('PayslipList', { kind: 'final' }),
    },
    {
      title: 'Cash advance',
      glyph: 'clock' as GlyphName,
      gradient: 'linear-gradient(135deg, #A8391A 0%, #C2603A 100%)',
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
          <View style={[styles.card, { experimental_backgroundImage: i.gradient }]}>
            <View style={styles.badge}>
              <GlyphIcon name={i.glyph} color="#FFFFFF" size={30} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <AppText variant="heading" style={styles.white}>
                {i.title}
              </AppText>
              <AppText variant="caption" style={styles.white}>
                {i.note}
              </AppText>
            </View>
            <AppText style={styles.white}>›</AppText>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  press: { minHeight: minTouchTarget },
  white: { color: '#FFFFFF' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    minHeight: 104,
    padding: spacing.xl,
    borderRadius: 24,
    boxShadow: '0 6px 16px rgba(18, 36, 61, 0.22)',
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
});

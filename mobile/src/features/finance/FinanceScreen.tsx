import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet } from 'react-native';
import { onTabScroll } from '@/app/navigation/tabBarCollapse';
import type { AppStackParamList, MainTabParamList } from '@/app/navigation/types';
import { NavRow, type GlyphName } from '@/components';
import { spacing } from '@/constants/theme';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Finance'>,
  NativeStackScreenProps<AppStackParamList>
>;

export function FinanceScreen({ navigation }: Props) {
  const items: { title: string; note: string; glyph: GlyphName; go: () => void }[] = [
    {
      title: 'Allotment',
      note: 'Your monthly and special pay. Asks for your password.',
      glyph: 'chart',
      go: () => navigation.navigate('PayslipList', { kind: 'allotment' }),
    },
    {
      title: 'Final pay',
      note: 'Your pay at the end of a contract. Asks for your password.',
      glyph: 'medal',
      go: () => navigation.navigate('PayslipList', { kind: 'final' }),
    },
    {
      title: 'Cash advance',
      note: 'What you borrowed and what is left to pay.',
      glyph: 'clock',
      go: () => navigation.navigate('Loans'),
    },
  ];
  return (
    <ScrollView
      onScroll={onTabScroll}
      scrollEventThrottle={16}
      contentContainerStyle={styles.content}
    >
      {items.map((i) => (
        <NavRow key={i.title} title={i.title} note={i.note} glyph={i.glyph} onPress={i.go} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: spacing.lg, gap: spacing.lg } });

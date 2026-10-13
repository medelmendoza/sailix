import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { AppStackParamList } from '@/app/navigation/types';
import { AppText, Card } from '@/components';
import { minTouchTarget, radius, spacing } from '@/constants/theme';
import { HELP } from './content';
import { HelpCard } from './parts';
import { SOUNDS } from './sounds';

type Props = NativeStackScreenProps<AppStackParamList, 'AstraNoise'>;

export function NoiseScreen({ navigation }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <HelpCard {...HELP.noise} />
      {(['Focus', 'Rest'] as const).map((category) => (
        <View key={category} style={{ gap: spacing.md }}>
          <AppText variant="heading" accessibilityRole="header">
            {category}
          </AppText>
          {SOUNDS.filter((s) => s.category === category).map((s) => (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityLabel={`${s.title}, ${category} sound`}
              onPress={() => navigation.navigate('AstraSound', { id: s.id })}
              style={({ pressed }) => [styles.tile, pressed && { opacity: 0.75 }]}
            >
              <Card style={styles.card}>
                <Image source={s.image} accessibilityElementsHidden style={styles.thumb} />
                <AppText variant="heading" style={{ flex: 1 }}>
                  {s.title}
                </AppText>
                <AppText muted>›</AppText>
              </Card>
            </Pressable>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  tile: { minHeight: minTouchTarget },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  thumb: { width: 64, height: 64, borderRadius: radius.md },
});

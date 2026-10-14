import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { AppStackParamList } from '@/app/navigation/types';
import { AppText } from '@/components';
import { spacing } from '@/constants/theme';
import { HELP } from './content';
import { Grid, GridTile, useHelp } from './parts';
import { SOUNDS } from './sounds';

type Props = NativeStackScreenProps<AppStackParamList, 'AstraNoise'>;

export function NoiseScreen({ navigation }: Props) {
  const help = useHelp(HELP.noise);
  return (
    <ScrollView contentContainerStyle={styles.content}>
      {help}
      {(['Focus', 'Rest'] as const).map((category) => (
        <View key={category} style={{ gap: spacing.md }}>
          <AppText variant="heading" accessibilityRole="header">
            {category}
          </AppText>
          <Grid>
            {SOUNDS.filter((s) => s.category === category).map((s) => (
              <GridTile
                key={s.id}
                title={s.title}
                image={s.image}
                tone={category === 'Focus' ? 'coral' : 'teal'}
                label={`${s.title}, ${category} sound`}
                onPress={() => navigation.navigate('AstraSound', { id: s.id })}
              />
            ))}
          </Grid>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: spacing.lg, gap: spacing.lg } });

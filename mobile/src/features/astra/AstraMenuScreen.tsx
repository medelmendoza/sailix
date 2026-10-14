import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { AppStackParamList } from '@/app/navigation/types';
import { AppText } from '@/components';
import { spacing } from '@/constants/theme';
import { ServiceLogo } from '@/features/services/ServiceLogo';
import { Grid, GridTile } from './parts';

type Props = NativeStackScreenProps<AppStackParamList, 'AstraMenu'>;

export function AstraMenuScreen({ navigation }: Props) {
  const items = [
    {
      title: 'Pomodoro',
      glyph: 'clock',
      tone: 'coral',
      go: () => navigation.navigate('AstraPomodoro'),
    },
    {
      title: 'Focus and Rest sounds',
      glyph: 'music',
      tone: 'coral',
      go: () => navigation.navigate('AstraNoise'),
    },
    {
      title: 'Risk management',
      glyph: 'alert',
      tone: 'teal',
      go: () => navigation.navigate('AstraRisk'),
    },
    {
      title: 'Root cause analysis',
      glyph: 'search',
      tone: 'teal',
      go: () => navigation.navigate('AstraRca'),
    },
    {
      title: 'SCARIL',
      glyph: 'target',
      tone: 'primary',
      go: () => navigation.navigate('AstraScaril'),
    },
    {
      title: 'Military style emails',
      glyph: 'mail',
      tone: 'primary',
      go: () => navigation.navigate('AstraEmails'),
    },
  ] as const;
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <AppText muted>Tools for clear thinking, focus and communication.</AppText>
      <Grid>
        {items.map((i) => (
          <GridTile key={i.title} title={i.title} glyph={i.glyph} onPress={i.go} />
        ))}
      </Grid>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  intro: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet } from 'react-native';
import type { AppStackParamList } from '@/app/navigation/types';
import { AppText, GlassBackground, useGlassHeader } from '@/components';
import { spacing } from '@/constants/theme';
import { Grid, GridTile } from './parts';

type Props = NativeStackScreenProps<AppStackParamList, 'AstraMenu'>;

export function AstraMenuScreen({ navigation }: Props) {
  useGlassHeader();
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
    <GlassBackground>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText style={{ color: '#FFFFFF' }}>
          Tools for clear thinking, focus and communication.
        </AppText>
        <Grid>
          {items.map((i) => (
            <GridTile
              key={i.title}
              title={i.title}
              glyph={i.glyph}
              tone={i.tone}
              glass
              onPress={i.go}
            />
          ))}
        </Grid>
      </ScrollView>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({ content: { padding: spacing.lg, gap: spacing.lg } });

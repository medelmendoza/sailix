import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { AppStackParamList } from '@/app/navigation/types';
import { AppText, type GlyphName } from '@/components';
import { colors, gradients, radius, spacing } from '@/constants/theme';
import { ServiceLogo } from '@/features/services/ServiceLogo';
import { useSessionStore } from '@/store/sessionStore';
import { Grid, MenuCard } from './parts';

type Props = NativeStackScreenProps<AppStackParamList, 'AstraMenu'>;

type Tool = {
  title: string;
  note: string;
  glyph: GlyphName;
  go: () => void;
};

export function AstraMenuScreen({ navigation }: Props) {
  const me = useSessionStore((s) => s.me);
  const name = me?.profile?.first_name ?? me?.user.display_name ?? me?.user.username ?? '';
  const sections: { heading: string; tint: 'amber' | 'green' | 'blue'; tools: Tool[] }[] = [
    {
      heading: 'Focus',
      tint: 'amber',
      tools: [
        {
          title: 'Pomodoro',
          note: 'Work in focused 25-minute rounds with breaks.',
          glyph: 'clock',
          go: () => navigation.navigate('AstraPomodoro'),
        },
        {
          title: 'Focus and Rest sounds',
          note: 'Background noise to concentrate or unwind.',
          glyph: 'music',
          go: () => navigation.navigate('AstraNoise'),
        },
      ],
    },
    {
      heading: 'Think it through',
      tint: 'green',
      tools: [
        {
          title: 'Risk management',
          note: 'Reduce, avoid, accept or transfer a risk.',
          glyph: 'alert',
          go: () => navigation.navigate('AstraRisk'),
        },
        {
          title: 'Root cause analysis',
          note: '5 Whys and P.M.E.P.E.',
          glyph: 'search',
          go: () => navigation.navigate('AstraRca'),
        },
      ],
    },
    {
      heading: 'Communicate',
      tint: 'blue',
      tools: [
        {
          title: 'SCARIL',
          note: 'A framework to assess and report a problem.',
          glyph: 'target',
          go: () => navigation.navigate('AstraScaril'),
        },
        {
          title: 'Military style emails',
          note: 'Write clear, effective emails.',
          glyph: 'mail',
          go: () => navigation.navigate('AstraEmails'),
        },
      ],
    },
  ];
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <AppText style={styles.white}>Welcome,</AppText>
          <AppText variant="title" accessibilityRole="header" style={styles.white}>
            {name}
          </AppText>
          <AppText variant="caption" style={styles.white}>
            Tools for clear thinking, focus and communication.
          </AppText>
        </View>
        <ServiceLogo code="astra" size={60} />
      </View>
      {sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <AppText variant="heading" accessibilityRole="header">
            {section.heading}
          </AppText>
          <Grid>
            {section.tools.map((t) => (
              <MenuCard
                key={t.title}
                title={t.title}
                note={t.note}
                glyph={t.glyph}
                tint={section.tint}
                onPress={t.go}
              />
            ))}
          </Grid>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.xl },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    experimental_backgroundImage: gradients.header,
  },
  white: { color: colors.onPrimary },
  section: { gap: spacing.md },
});

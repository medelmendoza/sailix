import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet } from 'react-native';
import type { AppStackParamList } from '@/app/navigation/types';
import { AppText } from '@/components';
import { spacing } from '@/constants/theme';
import { Tile } from './parts';

type Props = NativeStackScreenProps<AppStackParamList, 'AstraMenu'>;

export function AstraMenuScreen({ navigation }: Props) {
  const items = [
    {
      title: 'Pomodoro',
      note: 'Work in focused 25-minute rounds with breaks.',
      go: () => navigation.navigate('AstraPomodoro'),
    },
    {
      title: 'Focus and Rest sounds',
      note: 'Background noise to concentrate or unwind.',
      go: () => navigation.navigate('AstraNoise'),
    },
    {
      title: 'Risk management',
      note: 'Reduce, avoid, accept or transfer a risk.',
      go: () => navigation.navigate('AstraRisk'),
    },
    {
      title: 'Root cause analysis',
      note: '5 Whys and P.M.E.P.E.',
      go: () => navigation.navigate('AstraRca'),
    },
    {
      title: 'SCARIL',
      note: 'A framework to assess and report a problem.',
      go: () => navigation.navigate('AstraScaril'),
    },
    {
      title: 'Military style emails',
      note: 'Write clear, effective emails.',
      go: () => navigation.navigate('AstraEmails'),
    },
  ];
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <AppText muted>Tools for clear thinking, focus and communication.</AppText>
      {items.map((i) => (
        <Tile key={i.title} title={i.title} note={i.note} onPress={i.go} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: spacing.lg, gap: spacing.lg } });

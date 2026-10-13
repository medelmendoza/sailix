import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, View } from 'react-native';
import type { AppStackParamList } from '@/app/navigation/types';
import { AppText, Button, Card, ProgressBar } from '@/components';
import { colors, spacing } from '@/constants/theme';
import { useTalaCourses } from './api';
import { dueInfo, overall, upcoming } from './stats';

/**
 * Home card: overall learning progress and the next due dates. It must never get in the way of the rest of Home: while Tala
 * loads, when it fails, or when there is nothing to show, it renders nothing (the Services list below is unaffected).
 */
export function TalaLearningSummary() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const courses = useTalaCourses();
  if (!courses.data || courses.data.data.length === 0) return null;

  const list = courses.data.data;
  const o = overall(list);
  const due = upcoming(list, 3);

  return (
    <Card style={{ gap: spacing.sm }}>
      <AppText variant="heading" accessibilityRole="header">
        My learning
      </AppText>
      <ProgressBar percent={o.percent} label="Overall progress" />
      <AppText variant="caption" muted>
        {o.itemsDone} of {o.itemsTotal} items completed · {o.completed} of {o.courses} courses
        completed
        {courses.data.fromCache ? ' · saved copy' : ''}
      </AppText>
      {due.length > 0 ? (
        <View style={{ gap: spacing.xs }}>
          <AppText variant="caption" muted>
            Due dates
          </AppText>
          {due.map((c) => {
            const info = dueInfo(c);
            return (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                accessibilityLabel={`${c.name}, ${info?.text ?? ''}`}
                onPress={() => navigation.navigate('TalaCourse', { assignId: c.id, name: c.name })}
                style={{ minHeight: 44, justifyContent: 'center' }}
              >
                <AppText>{c.name}</AppText>
                <AppText
                  variant="caption"
                  style={{
                    color:
                      info?.tone === 'overdue'
                        ? colors.danger
                        : info?.tone === 'soon'
                          ? colors.warning
                          : colors.textMuted,
                  }}
                >
                  {info?.text} · {c.date_to}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <Button
        title="See my stats"
        variant="secondary"
        onPress={() => navigation.navigate('TalaStats')}
      />
    </Card>
  );
}

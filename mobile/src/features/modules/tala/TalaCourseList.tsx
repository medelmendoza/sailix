import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { AppStackParamList } from '@/app/navigation/types';
import { AppText, Card, EmptyState, ErrorState, SkeletonList } from '@/components';
import { minTouchTarget, spacing } from '@/constants/theme';
import { describeError } from '@/services/api/errors';
import { useTalaCourses } from './api';

export function TalaCourseList({ header }: { header: React.ReactNode }) {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const courses = useTalaCourses();
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    await courses.refetch();
    setRefreshing(false);
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
    >
      {header}
      <AppText variant="heading">My courses</AppText>
      {courses.isPending ? (
        <SkeletonList />
      ) : courses.isError ? (
        <ErrorState message={describeError(courses.error)} onRetry={() => void courses.refetch()} />
      ) : courses.data.length === 0 ? (
        <EmptyState
          title="No courses assigned"
          description="Nothing has been assigned to you in Tala yet."
        />
      ) : (
        courses.data.map((c) => (
          <Pressable
            key={c.id}
            accessibilityRole="button"
            accessibilityLabel={`${c.name}, ${c.total_materials} items`}
            onPress={() => navigation.navigate('TalaCourse', { assignId: c.id, name: c.name })}
            style={({ pressed }) => (pressed ? styles.pressed : undefined)}
          >
            <Card style={styles.row}>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="heading">{c.name}</AppText>
                {c.date_to ? (
                  <AppText variant="caption" muted>
                    Due {c.date_to}
                  </AppText>
                ) : null}
                <AppText variant="caption" muted>
                  {c.total_materials} items{c.progress ? ` · ${c.progress}% complete` : ''}
                </AppText>
              </View>
              <AppText muted>›</AppText>
            </Card>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: minTouchTarget, gap: spacing.md },
  pressed: { opacity: 0.7 },
});

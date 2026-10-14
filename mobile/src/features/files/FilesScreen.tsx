import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { AppStackParamList, MainTabParamList } from '@/app/navigation/types';
import { AppText, Button, EmptyState, ErrorState, Notice, SkeletonList } from '@/components';
import { colors, minTouchTarget, radius, spacing } from '@/constants/theme';
import { describeError } from '@/services/api/errors';
import { DocumentCard } from './DocumentCard';
import { useDocuments, type DocumentView } from './api';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Files'>,
  NativeStackScreenProps<AppStackParamList>
>;

const VIEWS: { value: DocumentView; label: string }[] = [
  { value: 'approved', label: 'Documents' },
  { value: 'review', label: 'Pending' },
];

export function FilesScreen({ navigation }: Props) {
  const [view, setView] = useState<DocumentView>('approved');
  const docs = useDocuments(view);
  const approved = useDocuments('approved'); // same query when on the first view: the warning banner needs it on both
  const [refreshing, setRefreshing] = useState(false);
  const counts = approved.data?.counts;
  const warn: string[] = [];
  if (counts?.expired) warn.push(`${counts.expired} expired`);
  if (counts?.expiring) warn.push(`${counts.expiring} expiring soon`);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void Promise.all([docs.refetch(), approved.refetch()]).finally(() =>
              setRefreshing(false),
            );
          }}
        />
      }
    >
      <AppText variant="title" accessibilityRole="header">
        Files
      </AppText>
      {warn.length > 0 ? (
        <Notice tone="warning" message={`Check your documents: ${warn.join(', ')}.`} />
      ) : null}
      <View style={styles.views} accessibilityRole="radiogroup">
        {VIEWS.map((v) => {
          const picked = view === v.value;
          return (
            <Pressable
              key={v.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: picked }}
              accessibilityLabel={v.label}
              onPress={() => setView(v.value)}
              style={[styles.view, picked && styles.viewPicked]}
            >
              <AppText
                variant="button"
                style={{ color: picked ? colors.primary : colors.textMuted }}
              >
                {v.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <Button title="Add a document" onPress={() => navigation.navigate('DocumentForm', {})} />
      {docs.isPending ? (
        <SkeletonList />
      ) : docs.isError ? (
        <ErrorState message={describeError(docs.error)} onRetry={() => void docs.refetch()} />
      ) : docs.data.data.length === 0 ? (
        <EmptyState
          title={view === 'approved' ? 'No documents yet' : 'Nothing waiting'}
          description={
            view === 'approved'
              ? 'Documents approved by your agency appear here. Add one to get started.'
              : 'Documents you submit wait here until your agency approves them.'
          }
        />
      ) : (
        docs.data.data.map((d) => (
          <DocumentCard
            key={d.id}
            doc={d}
            onPress={() => navigation.navigate('Document', { id: d.id })}
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, gap: spacing.xl },
  views: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunken,
  },
  view: {
    flex: 1,
    minHeight: minTouchTarget - 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  viewPicked: { backgroundColor: colors.surface, boxShadow: '0 1px 4px rgba(18, 36, 61, 0.15)' },
});

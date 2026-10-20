import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { onTabScroll } from '@/app/navigation/tabBarCollapse';
import type { AppStackParamList, MainTabParamList } from '@/app/navigation/types';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Notice,
  Segmented,
  SkeletonList,
} from '@/components';
import { colors, spacing } from '@/constants/theme';
import { describeError } from '@/services/api/errors';
import { DocumentCard } from './DocumentCard';
import { useDocumentRequests, useDocuments, type DocumentView } from './api';

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
  const requests = useDocumentRequests();
  const [refreshing, setRefreshing] = useState(false);
  const counts = approved.data?.counts;
  const warn: string[] = [];
  if (counts?.expired) warn.push(`${counts.expired} expired`);
  if (counts?.expiring) warn.push(`${counts.expiring} expiring soon`);

  return (
    <ScrollView
      onScroll={onTabScroll}
      scrollEventThrottle={16}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void Promise.all([docs.refetch(), approved.refetch(), requests.refetch()]).finally(() =>
              setRefreshing(false),
            );
          }}
        />
      }
    >
      {warn.length > 0 ? (
        <Notice tone="warning" message={`Check your documents: ${warn.join(', ')}.`} />
      ) : null}
      {requests.data && requests.data.length > 0 ? (
        <Card variant="flat" style={styles.requested}>
          <AppText variant="heading" accessibilityRole="header">
            Requested by your agency
          </AppText>
          <AppText muted>Please send these documents in.</AppText>
          {requests.data.map((r) => (
            <View key={r.type.id} style={styles.requestRow}>
              <AppText style={styles.requestName}>{r.type.name}</AppText>
              <Button
                title="Submit"
                variant="secondary"
                accessibilityLabel={`Submit ${r.type.name}`}
                onPress={() => navigation.navigate('DocumentForm', { typeId: r.type.id })}
                style={styles.requestButton}
              />
            </View>
          ))}
        </Card>
      ) : null}
      <Segmented options={VIEWS} value={view} onChange={setView} />
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
  requested: { gap: spacing.md, padding: spacing.lg },
  requestRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  requestName: { flex: 1, fontFamily: 'Quicksand_700Bold', fontSize: 16, color: colors.text },
  requestButton: { minHeight: 40, paddingHorizontal: spacing.lg },
});

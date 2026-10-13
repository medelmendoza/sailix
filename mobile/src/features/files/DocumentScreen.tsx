import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { AppStackParamList } from '@/app/navigation/types';
import { AppText, Button, Card, ErrorState, FormError, SkeletonList } from '@/components';
import { spacing } from '@/constants/theme';
import { describeError, toApiError } from '@/services/api/errors';
import { documentBadge } from './expiry';
import { useDocument } from './api';

type Props = NativeStackScreenProps<AppStackParamList, 'Document'>;

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <AppText variant="caption" muted>
        {label}
      </AppText>
      <AppText>{value}</AppText>
    </View>
  );
}

export function DocumentScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const one = useDocument(id);

  if (one.isError) {
    const gone = toApiError(one.error).status === 404;
    return (
      <ErrorState
        message={gone ? 'This document is no longer available.' : describeError(one.error)}
        onRetry={gone ? undefined : () => void one.refetch()}
      />
    );
  }
  const doc = one.data;
  if (!doc) return <SkeletonList />;
  const badge = documentBadge(doc);
  const editable = doc.status !== 'approved';

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <AppText variant="title" accessibilityRole="header">
        {doc.type.name}
      </AppText>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: badge.background }]}>
          <AppText variant="caption" style={{ color: badge.color }}>
            {badge.text}
          </AppText>
        </View>
      ) : null}
      {doc.status === 'rejected' && doc.rejection_reason ? (
        <FormError message={`Your agency sent this back: ${doc.rejection_reason}`} />
      ) : null}
      <Card style={styles.card}>
        <Row label="Number" value={doc.number} />
        <Row label="Grade" value={doc.grade} />
        <Row label="Place of issue" value={doc.location} />
        <Row label="School" value={doc.school} />
        <Row label="Issued" value={doc.issued_on} />
        <Row label="Expires" value={doc.expires_on} />
        <Row label="File" value={doc.file.name} />
      </Card>
      <Button
        title="View file"
        onPress={() => navigation.navigate('DocumentViewer', { id: doc.id, name: doc.type.name })}
      />
      {editable ? (
        <Button
          title={doc.status === 'rejected' ? 'Fix and send again' : 'Edit and send again'}
          variant="secondary"
          onPress={() => navigation.navigate('DocumentForm', { id: doc.id })}
        />
      ) : (
        <AppText variant="caption" muted>
          An approved document cannot be changed. To update it, add a new document.
        </AppText>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  card: { gap: spacing.md },
  row: { gap: 2 },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
});

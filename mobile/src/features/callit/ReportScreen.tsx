import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { AppStackParamList } from '@/app/navigation/types';
import { AppText, Button, Card, ErrorState, Notice, SkeletonList } from '@/components';
import { spacing } from '@/constants/theme';
import { describeError, toApiError } from '@/services/api/errors';
import { useCallItReport } from './api';
import { CLASSIFICATIONS, LOCATIONS, STATUS_LABEL, SUB_CLASSIFICATIONS, labelOf } from './content';

type Props = NativeStackScreenProps<AppStackParamList, 'CallItReport'>;

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={{ gap: 2 }}>
      <AppText variant="caption" muted>
        {label}
      </AppText>
      <AppText>{value}</AppText>
    </View>
  );
}

/** A report that was sent: read-only. The text is shown as text, never as HTML. */
export function ReportScreen({ route, navigation }: Props) {
  const one = useCallItReport(route.params.id);
  if (one.isError) {
    const gone = toApiError(one.error).status === 404;
    return (
      <ErrorState
        message={gone ? 'This report is no longer available.' : describeError(one.error)}
        onRetry={gone ? undefined : () => void one.refetch()}
      />
    );
  }
  const r = one.data;
  if (!r) return <SkeletonList />;
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <AppText variant="title" accessibilityRole="header">
        {labelOf(CLASSIFICATIONS, r.classification)}
      </AppText>
      <Notice
        tone={r.status === 'reviewed' ? 'success' : 'info'}
        message={
          r.status === 'reviewed'
            ? 'Your organization has reviewed this report.'
            : 'Sent. Your organization will review it.'
        }
      />
      <Card style={styles.card}>
        <Row label="Status" value={STATUS_LABEL[r.status]} />
        <Row
          label="Sub-classification"
          value={labelOf(SUB_CLASSIFICATIONS, r.sub_classification)}
        />
        <Row
          label="Location"
          value={
            r.location === 'others' && r.location_other
              ? `Others: ${r.location_other}`
              : labelOf(LOCATIONS, r.location)
          }
        />
        <Row label="Vessel" value={r.vessel} />
        <Row label="Details of the incident" value={r.details} />
        <Row label="Did you intervene?" value={r.intervened ? 'Yes' : 'No'} />
        <Row label="How you intervened" value={r.intervention_details} />
        <Row
          label="Official reporting"
          value={r.official_report ? 'You said this needs official reporting.' : null}
        />
        <Row label="Attached file" value={r.file?.name} />
      </Card>
      {r.file ? (
        <Button
          title="View the file"
          variant="secondary"
          onPress={() =>
            navigation.navigate('DocumentViewer', {
              id: r.id,
              name: 'Attached file',
              source: 'callit',
            })
          }
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  card: { gap: spacing.md },
});

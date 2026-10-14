import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import type { AppStackParamList } from '@/app/navigation/types';
import { AppText, Button, Card, ErrorState, FormError, SkeletonList } from '@/components';
import { colors, fonts, minTouchTarget, radius, spacing } from '@/constants/theme';
import { describeError, toApiError } from '@/services/api/errors';
import type { PickedFile } from '@/features/files/api';
import { discard } from '@/features/scanner/scan';
import { useScanStore } from '@/features/scanner/scanStore';
import { useCallItReport, useDeleteDraft, useSaveReport } from './api';
import { CLASSIFICATIONS, LOCATIONS, SUB_CLASSIFICATIONS, labelOf } from './content';

type Props = NativeStackScreenProps<AppStackParamList, 'CallItForm'>;
type Values = {
  classification: string;
  sub: string;
  location: string;
  other: string;
  vessel: string;
  details: string;
  intervened: boolean | null;
  how: string;
};
const EMPTY: Values = {
  classification: '',
  sub: '',
  location: '',
  other: '',
  vessel: '',
  details: '',
  intervened: null,
  how: '',
};

/** Write a report, keep it as a draft, or send it. A sent report belongs to the organization and can no longer change. */
export function ReportFormScreen({ route, navigation }: Props) {
  const id = route.params.id;
  const existing = useCallItReport(id ?? '');
  const save = useSaveReport();
  const remove = useDeleteDraft();
  const [v, setV] = useState<Values | null>(id ? null : EMPTY);
  const [file, setFile] = useState<PickedFile | null>(null);
  const takeScan = useScanStore((s) => s.take);

  useFocusEffect(
    useCallback(() => {
      const scanned = takeScan();
      if (scanned) setFile(scanned);
    }, [takeScan]),
  );
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [official, setOfficial] = useState<boolean | null>(null);

  if (id && !v && existing.data) {
    const r = existing.data;
    setV({
      classification: r.classification ?? '',
      sub: r.sub_classification ?? '',
      location: r.location ?? '',
      other: r.location_other ?? '',
      vessel: r.vessel ?? '',
      details: r.details ?? '',
      intervened: r.intervened,
      how: r.intervention_details ?? '',
    });
    setOfficial(r.official_report);
  }
  if (id && existing.isError)
    return (
      <ErrorState message={describeError(existing.error)} onRetry={() => void existing.refetch()} />
    );
  if (!v) return <SkeletonList />;
  const set = (patch: Partial<Values>) => setV({ ...v, ...patch });

  const payload = (submitted: boolean) =>
    ({
      classification: v.classification || null,
      sub_classification: v.sub || null,
      location: v.location || null,
      location_other: v.location === 'others' ? v.other.trim() || null : null,
      vessel: v.vessel.trim() || null,
      details: v.details.trim() || null,
      intervened: v.intervened === true,
      intervention_details: v.intervened === true ? v.how.trim() || null : null,
      ...(submitted ? { official_report: official === true } : {}),
    }) as never;

  /** What is missing before it can be sent (the server checks again). */
  function missing(): Record<string, string> {
    const m: Record<string, string> = {};
    if (!v!.classification) m.classification = 'Choose the classification.';
    if (!v!.sub) m.sub = 'Choose the sub-classification.';
    if (!v!.location) m.location = 'Choose where it happened.';
    if (v!.location === 'others' && !v!.other.trim()) m.other = 'Say where it happened.';
    if (!v!.vessel.trim()) m.vessel = 'Enter the vessel.';
    if (v!.details.trim().length < 3) m.details = 'Describe the incident.';
    if (v!.intervened === null) m.intervened = 'Say whether you intervened.';
    if (v!.intervened === true && !v!.how.trim()) m.how = 'Describe how you intervened.';
    return m;
  }

  async function pick() {
    const r = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    const a = r.canceled ? null : r.assets[0];
    if (a) setFile({ uri: a.uri, name: a.name, mimeType: a.mimeType ?? 'application/pdf' });
  }

  async function run(submit: boolean) {
    setError(null);
    try {
      await save.mutateAsync({ id, fields: payload(submit), file, submit });
      setConfirming(false);
      if (file) discard([file.uri]);
      navigation.goBack();
    } catch (e) {
      setConfirming(false);
      const api = toApiError(e);
      setError(api.field('file') ?? describeError(e));
    }
  }

  function send() {
    const m = missing();
    setProblems(m);
    if (Object.keys(m).length > 0) return setError('Fill in what is marked below, then send.');
    setError(null);
    setConfirming(true);
  }

  function deleteDraft() {
    Alert.alert('Delete this draft?', 'It is removed for good.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          void remove
            .mutateAsync(id!)
            .then(() => navigation.goBack())
            .catch((e) => setError(describeError(e))),
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <FormError message={error} />
      <Choice
        label="Classification"
        options={CLASSIFICATIONS}
        value={v.classification}
        onPick={(x) => set({ classification: x })}
        error={problems.classification}
      />
      <Choice
        label="Sub-classification"
        options={SUB_CLASSIFICATIONS}
        value={v.sub}
        onPick={(x) => set({ sub: x })}
        error={problems.sub}
      />
      <Choice
        label="Location"
        options={LOCATIONS}
        value={v.location}
        onPick={(x) => set({ location: x })}
        error={problems.location}
      />
      {v.location === 'others' ? (
        <Field
          label="Where, exactly?"
          value={v.other}
          onChange={(x) => set({ other: x })}
          max={120}
          error={problems.other}
        />
      ) : null}
      <Field
        label="Vessel"
        value={v.vessel}
        onChange={(x) => set({ vessel: x })}
        max={120}
        error={problems.vessel}
      />
      <Field
        label="Details of the incident"
        value={v.details}
        onChange={(x) => set({ details: x })}
        max={2000}
        multiline
        error={problems.details}
        hint="Give a brief description of what you saw."
      />
      <YesNo
        label="Did you intervene?"
        value={v.intervened}
        onPick={(x) => set({ intervened: x })}
        error={problems.intervened}
      />
      {v.intervened ? (
        <Field
          label="How you intervened"
          value={v.how}
          onChange={(x) => set({ how: x })}
          max={2000}
          multiline
          error={problems.how}
        />
      ) : null}

      <Button
        title="Scan with the camera"
        variant="secondary"
        onPress={() => navigation.navigate('Scanner')}
      />
      <Button
        title={
          file
            ? 'Choose a different file'
            : existing.data?.file
              ? 'Replace the file (optional)'
              : 'Attach a photo or PDF (optional)'
        }
        variant="secondary"
        onPress={() => void pick()}
      />
      {file ? (
        <AppText>{file.name}</AppText>
      ) : existing.data?.file ? (
        <AppText muted>{existing.data.file.name}</AppText>
      ) : null}

      <Button title="Send report" onPress={send} loading={save.isPending && confirming} />
      <Button
        title="Save as draft"
        variant="secondary"
        loading={save.isPending && !confirming}
        onPress={() => void run(false)}
      />
      {id ? <Button title="Delete this draft" variant="secondary" onPress={deleteDraft} /> : null}

      <Modal
        visible={confirming}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirming(false)}
      >
        <View style={styles.backdrop}>
          <Card style={styles.sheet}>
            <ScrollView contentContainerStyle={{ gap: spacing.sm }}>
              <AppText variant="heading" accessibilityRole="header">
                Report summary
              </AppText>
              <Line
                label="Classification"
                value={`${labelOf(CLASSIFICATIONS, v.classification)} · ${labelOf(SUB_CLASSIFICATIONS, v.sub)}`}
              />
              <Line
                label="Location"
                value={
                  v.location === 'others' ? `Others: ${v.other}` : labelOf(LOCATIONS, v.location)
                }
              />
              <Line label="Vessel" value={v.vessel} />
              <Line label="Details" value={v.details} />
              <Line label="Intervened" value={v.intervened ? v.how : 'No'} />
              {file ? <Line label="File" value={file.name} /> : null}
              <AppText variant="heading">Does this incident require official reporting?</AppText>
              <YesNo label="" value={official} onPick={setOfficial} noLabel="No, not needed" />
              <Button
                title="Send"
                disabled={official === null}
                loading={save.isPending}
                onPress={() => void run(true)}
              />
              <Button title="Cancel" variant="secondary" onPress={() => setConfirming(false)} />
            </ScrollView>
          </Card>
        </View>
      </Modal>
    </ScrollView>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 2 }}>
      <AppText variant="caption" muted>
        {label}
      </AppText>
      <AppText>{value}</AppText>
    </View>
  );
}

function Choice({
  label,
  options,
  value,
  onPick,
  error,
}: {
  label: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onPick: (v: string) => void;
  error?: string;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="caption">{label}</AppText>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {options.map((o) => {
          const picked = value === o.value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityLabel={o.label}
              accessibilityState={{ checked: picked }}
              onPress={() => onPick(o.value)}
              style={[styles.chip, picked && styles.chipPicked]}
            >
              <AppText variant="caption" style={{ color: picked ? colors.onPrimary : colors.text }}>
                {o.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <AppText variant="caption" style={styles.err}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

function YesNo({
  label,
  value,
  onPick,
  error,
  noLabel = 'No',
}: {
  label: string;
  value: boolean | null;
  onPick: (v: boolean) => void;
  error?: string;
  noLabel?: string;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      {label ? <AppText variant="caption">{label}</AppText> : null}
      <View style={styles.chips} accessibilityRole="radiogroup">
        {(
          [
            [true, 'Yes'],
            [false, noLabel],
          ] as const
        ).map(([x, text]) => (
          <Pressable
            key={text}
            accessibilityRole="radio"
            accessibilityLabel={text}
            accessibilityState={{ checked: value === x }}
            onPress={() => onPick(x)}
            style={[styles.chip, value === x && styles.chipPicked]}
          >
            <AppText
              variant="caption"
              style={{ color: value === x ? colors.onPrimary : colors.text }}
            >
              {text}
            </AppText>
          </Pressable>
        ))}
      </View>
      {error ? (
        <AppText variant="caption" style={styles.err}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  max,
  multiline,
  error,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  multiline?: boolean;
  error?: string;
  hint?: string;
}) {
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="caption">{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={hint}
        value={value}
        onChangeText={onChange}
        maxLength={max}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          multiline && { minHeight: 110 },
          error ? { borderColor: colors.danger } : null,
        ]}
      />
      {error ? (
        <AppText variant="caption" style={styles.err}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: minTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipPicked: { backgroundColor: colors.primary, borderColor: colors.primary },
  input: {
    minHeight: minTouchTarget,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  err: { color: colors.danger },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: { maxHeight: '85%', gap: spacing.md },
});

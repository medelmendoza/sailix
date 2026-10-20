import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import type { AppStackParamList } from '@/app/navigation/types';
import { AppText, Button, ErrorState, FormError, Notice, SkeletonList } from '@/components';
import { colors, fonts, minTouchTarget, radius, spacing } from '@/constants/theme';
import { describeError, toApiError } from '@/services/api/errors';
import { discard } from '@/features/scanner/scan';
import { useScanStore } from '@/features/scanner/scanStore';
import { useDocument, useDocumentTypes, useSaveDocument, type PickedFile } from './api';
import { useBrand } from '@/theme/brand';

type Props = NativeStackScreenProps<AppStackParamList, 'DocumentForm'>;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isRealDay = (v: string) => {
  if (!DAY.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
};

type Values = {
  type: string;
  number: string;
  grade: string;
  location: string;
  school: string;
  issued: string;
  expires: string;
};
const EMPTY: Values = {
  type: '',
  number: '',
  grade: '',
  location: '',
  school: '',
  issued: '',
  expires: '',
};

/** Add a document, or fix and send again one that is waiting or was sent back. The owner and status are the server's call. */
export function DocumentFormScreen({ route, navigation }: Props) {
  const brand = useBrand();
  const id = route.params.id;
  const types = useDocumentTypes();
  const existing = useDocument(id ?? '');
  const save = useSaveDocument(id);
  const [v, setV] = useState<Values | null>(
    id ? null : { ...EMPTY, type: route.params.typeId ?? '' }, // arriving from "Requested by your agency" picks the kind
  );
  const [file, setFile] = useState<PickedFile | null>(null);
  const takeScan = useScanStore((s) => s.take);

  // a scan made on the scanner screen arrives when this screen is shown again
  useFocusEffect(
    useCallback(() => {
      const scanned = takeScan();
      if (scanned) setFile(scanned);
    }, [takeScan]),
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<Record<string, string>>({});

  if (id && !v && existing.data) {
    const d = existing.data;
    setV({
      type: d.type.id,
      number: d.number ?? '',
      grade: d.grade ?? '',
      location: d.location ?? '',
      school: d.school ?? '',
      issued: d.issued_on ?? '',
      expires: d.expires_on ?? '',
    });
  }
  if (types.isError)
    return <ErrorState message={describeError(types.error)} onRetry={() => void types.refetch()} />;
  if (id && existing.isError)
    return (
      <ErrorState message={describeError(existing.error)} onRetry={() => void existing.refetch()} />
    );
  if (!types.data || !v) return <SkeletonList />;

  const set = (patch: Partial<Values>) => setV({ ...v, ...patch });

  async function pick() {
    const r = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    const a = r.canceled ? null : r.assets[0];
    if (a) setFile({ uri: a.uri, name: a.name, mimeType: a.mimeType ?? 'application/pdf' });
  }

  async function submit() {
    if (!v) return;
    const problems: Record<string, string> = {};
    if (!v.type) problems.type = 'Choose the kind of document.';
    if (!id && !file) problems.file = 'Choose the file or photo of the document.';
    for (const k of ['issued', 'expires'] as const) {
      if (v[k] && !isRealDay(v[k]))
        problems[k] = 'Use the format YYYY-MM-DD, for example 2027-03-31.';
    }
    if (!problems.issued && !problems.expires && v.issued && v.expires && v.expires < v.issued) {
      problems.expires = 'The expiry date cannot be before the issue date.';
    }
    setFieldError(problems);
    setError(null);
    if (Object.keys(problems).length > 0) return;

    try {
      await save.mutateAsync({
        fields: {
          document_type_id: v.type,
          number: v.number.trim(),
          grade: v.grade.trim(),
          location: v.location.trim(),
          school: v.school.trim(),
          issued_on: v.issued,
          expires_on: v.expires,
        },
        file,
      });
      if (file) discard([file.uri]); // a scan is personal data: it does not stay in the cache once sent
      navigation.goBack();
    } catch (e) {
      const api = toApiError(e);
      setError(api.field('file') ?? api.field('expires_on') ?? describeError(e));
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Notice message="Your agency checks every document you send. Until then it shows as waiting." />
      <FormError message={error} />

      <AppText variant="caption">Kind of document</AppText>
      {types.data.length === 0 ? (
        <AppText muted>Your organization has not set up any document types yet.</AppText>
      ) : (
        <View style={styles.chips} accessibilityRole="radiogroup">
          {types.data.map((t) => {
            const picked = v.type === t.id;
            return (
              <Pressable
                key={t.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: picked }}
                accessibilityLabel={t.name}
                onPress={() => set({ type: t.id })}
                style={[
                  styles.chip,
                  picked && { backgroundColor: brand.primary, borderColor: brand.primary },
                ]}
              >
                <AppText
                  variant="caption"
                  style={{ color: picked ? colors.onPrimary : colors.text }}
                >
                  {t.name}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      )}
      {fieldError.type ? (
        <AppText variant="caption" style={styles.err}>
          {fieldError.type}
        </AppText>
      ) : null}

      <Field label="Number" value={v.number} onChange={(x) => set({ number: x })} max={80} />
      <Field label="Grade" value={v.grade} onChange={(x) => set({ grade: x })} max={80} />
      <Field
        label="Place of issue"
        value={v.location}
        onChange={(x) => set({ location: x })}
        max={120}
      />
      <Field label="School" value={v.school} onChange={(x) => set({ school: x })} max={120} />
      <Field
        label="Issued (YYYY-MM-DD)"
        value={v.issued}
        onChange={(x) => set({ issued: x })}
        error={fieldError.issued}
        date
      />
      <Field
        label="Expires (YYYY-MM-DD)"
        value={v.expires}
        onChange={(x) => set({ expires: x })}
        error={fieldError.expires}
        date
      />

      <Button
        title="Scan with the camera"
        variant="secondary"
        onPress={() => navigation.navigate('Scanner')}
      />
      <Button
        title={
          file ? 'Choose a different file' : id ? 'Replace the file (optional)' : 'Choose the file'
        }
        variant="secondary"
        onPress={() => void pick()}
      />
      {file ? <AppText>{file.name}</AppText> : null}
      {fieldError.file ? (
        <AppText variant="caption" style={styles.err}>
          {fieldError.file}
        </AppText>
      ) : null}
      <AppText variant="caption" muted>
        PDF, JPEG or PNG. Your organization sets the size limit.
      </AppText>

      <Button
        title={id ? 'Send again' : 'Send for approval'}
        loading={save.isPending}
        onPress={() => void submit()}
      />
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChange,
  max,
  error,
  date,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max?: number;
  error?: string;
  date?: boolean;
}) {
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="caption">{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        maxLength={date ? 10 : max}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={date ? 'numbers-and-punctuation' : 'default'}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, error ? { borderColor: colors.danger } : null]}
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
  input: {
    minHeight: minTouchTarget,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  err: { color: colors.danger },
});

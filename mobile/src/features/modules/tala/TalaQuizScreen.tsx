import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import type { AppStackParamList } from '@/app/navigation/types';
import { AppText, Button, Card, ErrorState, FormError, Notice, SkeletonList } from '@/components';
import { colors, minTouchTarget, radius, spacing } from '@/constants/theme';
import { describeError, toApiError } from '@/services/api/errors';
import type { TalaQuiz, TalaQuizResult } from '@/services/api/types';
import { scopedKey } from '@/store/scopedKey';
import { fetchTalaQuiz, submitTalaQuiz, type QuizAnswer } from './api';

type Props = NativeStackScreenProps<AppStackParamList, 'TalaQuiz'>;
type Value = string | string[];
type Question = TalaQuiz['sections'][number]['questions'][number];

const answered = (q: Question, v: Value | undefined) =>
  q.type === 'multiple'
    ? Array.isArray(v) && v.length > 0
    : typeof v === 'string' && v.trim() !== '';

/**
 * Takes a quiz. The questions arrive WITHOUT answers and the server does the scoring, so this screen never knows
 * whether an answer is right until it gets the total. Nothing about the quiz or the answers is kept on the device.
 */
export function TalaQuizScreen({ route, navigation }: Props) {
  const { assignId, quizId } = route.params;
  const queryClient = useQueryClient();
  // Never cached beyond this screen: a reopened quiz is always fetched fresh (it may have changed).
  const quizQuery = useQuery({
    queryKey: scopedKey('tala', 'quiz', assignId, quizId),
    queryFn: () => fetchTalaQuiz(assignId, quizId),
    gcTime: 0,
    staleTime: 0,
  });
  const [values, setValues] = useState<Record<string, Value>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<TalaQuizResult | null>(null);

  async function reload() {
    setValues({});
    await quizQuery.refetch();
  }

  if (quizQuery.isError) {
    return <ErrorState message={describeError(quizQuery.error)} onRetry={() => void reload()} />;
  }
  const quiz = quizQuery.data;
  if (!quiz) return <SkeletonList />;

  const questions = quiz.sections.flatMap((s) => s.questions);
  const complete = questions.every((q) => answered(q, values[q.ref]));

  function choose(q: Question, index: string) {
    setValues((cur) => {
      if (q.type === 'single') return { ...cur, [q.ref]: index };
      const now = Array.isArray(cur[q.ref]) ? (cur[q.ref] as string[]) : [];
      return {
        ...cur,
        [q.ref]: now.includes(index) ? now.filter((i) => i !== index) : [...now, index],
      };
    });
  }

  async function submit() {
    if (!quiz) return;
    setError(null);
    setSubmitting(true);
    try {
      const answers: QuizAnswer[] = questions.map((q) => ({
        ref: q.ref,
        value: values[q.ref] as Value,
      }));
      const r = await submitTalaQuiz(assignId, quizId, quiz.version, answers);
      setResult(r);
      await queryClient.invalidateQueries({ queryKey: scopedKey('tala') });
    } catch (e) {
      setError(describeError(e));
      if (toApiError(e).code === 'quiz_changed') await reload();
    } finally {
      setSubmitting(false);
    }
  }

  function confirmSubmit() {
    Alert.alert(
      'Submit your answers?',
      'Your score is recorded in Tala. You can retake the quiz later.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Submit', onPress: () => void submit() },
      ],
    );
  }

  if (result) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="title" accessibilityRole="header">
          {result.passed ? 'Passed' : 'Not passed'}
        </AppText>
        <Card style={{ gap: spacing.sm }}>
          <AppText variant="heading">You got {result.average}%</AppText>
          <AppText>
            {result.correct} correct, {result.wrong} wrong, {result.total} questions
          </AppText>
        </Card>
        <Notice message="Your score was calculated by Sailix and recorded in Tala." />
        <Button
          title="Retake quiz"
          variant="secondary"
          onPress={() => {
            setResult(null);
            void reload();
          }}
        />
        <Button title="Back to course" onPress={() => navigation.goBack()} />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <AppText variant="title" accessibilityRole="header">
        {quiz.name}
      </AppText>
      {quiz.description ? <AppText muted>{quiz.description}</AppText> : null}
      <FormError message={error} />
      {quiz.sections.map((s) => (
        <View key={s.id} style={{ gap: spacing.md }}>
          {s.title ? <AppText variant="heading">{s.title}</AppText> : null}
          {s.description ? <AppText muted>{s.description}</AppText> : null}
          {s.questions.map((q, i) => (
            <Card key={q.ref} style={{ gap: spacing.sm }}>
              <AppText accessibilityRole="header">{`${i + 1}. ${q.text}`}</AppText>
              {q.type === 'text' ? (
                <TextInput
                  accessibilityLabel={`Answer to question ${i + 1}`}
                  style={styles.input}
                  value={(values[q.ref] as string | undefined) ?? ''}
                  onChangeText={(t) => setValues((cur) => ({ ...cur, [q.ref]: t }))}
                  autoCapitalize="none"
                  maxLength={1000}
                />
              ) : (
                q.choices.map((c, ci) => {
                  const picked =
                    q.type === 'single'
                      ? values[q.ref] === String(ci)
                      : Array.isArray(values[q.ref]) &&
                        (values[q.ref] as string[]).includes(String(ci));
                  return (
                    <Pressable
                      key={ci}
                      accessibilityRole={q.type === 'single' ? 'radio' : 'checkbox'}
                      accessibilityState={{ checked: picked }}
                      accessibilityLabel={c}
                      onPress={() => choose(q, String(ci))}
                      style={[styles.option, picked && styles.optionPicked]}
                    >
                      <AppText>{c}</AppText>
                    </Pressable>
                  );
                })
              )}
            </Card>
          ))}
        </View>
      ))}
      <Button
        title="Submit answers"
        disabled={!complete}
        loading={submitting}
        onPress={confirmSubmit}
      />
      {!complete ? (
        <AppText variant="caption" muted>
          Answer every question to submit.
        </AppText>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  option: {
    minHeight: minTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionPicked: { borderColor: colors.primary, backgroundColor: '#E7EFF9' },
  input: {
    minHeight: minTouchTarget,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
  },
});

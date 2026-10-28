import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { BrandTextInput } from '../ui/BrandTextInput';
import type { TalaRoutes } from '../routes';
import {
  AppText,
  Button,
  Card,
  ErrorState,
  FormError,
  Notice,
  ProgressBar,
  SkeletonList,
} from '../ui';
import { colors, fonts, minTouchTarget, radius, shadows, spacing } from '../ui/theme';
import { describeError, toApiError } from '../errors';
import type { TalaQuiz, TalaQuizResult } from '../types';
import { scopedKey } from '../runtime';
import { fetchTalaQuiz, submitTalaQuiz, type QuizAnswer } from '../data/api';
import { useBrand } from '../ui/brand';

type Props = NativeStackScreenProps<TalaRoutes, 'TalaQuiz'>;
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
  const brand = useBrand();
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

  const answeredCount = questions.filter((q) => answered(q, values[q.ref])).length;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <AppText variant="title" accessibilityRole="header">
        {quiz.name}
      </AppText>
      {quiz.description ? <AppText muted>{quiz.description}</AppText> : null}
      <Card variant="flat" style={styles.progress}>
        <AppText variant="caption" muted>
          {`Answered ${answeredCount} of ${questions.length}`}
        </AppText>
        <ProgressBar
          percent={questions.length === 0 ? 0 : (answeredCount / questions.length) * 100}
          label={`${answeredCount} of ${questions.length} questions answered`}
        />
      </Card>
      <FormError message={error} />
      {quiz.sections.map((s) => (
        <View key={s.id} style={{ gap: spacing.md }}>
          {s.title ? <AppText variant="heading">{s.title}</AppText> : null}
          {s.description ? <AppText muted>{s.description}</AppText> : null}
          {s.questions.map((q, i) => {
            return (
              <Card key={q.ref} variant="flat" style={styles.question}>
                <AppText accessibilityRole="header" style={styles.questionText}>
                  {`${i + 1}. ${q.text}`}
                </AppText>
                {q.type === 'multiple' ? (
                  <AppText variant="caption" muted>
                    Choose all that apply.
                  </AppText>
                ) : null}
                {q.type === 'text' ? (
                  <BrandTextInput
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
                    const single = q.type === 'single';
                    return (
                      <Pressable
                        key={ci}
                        accessibilityRole={single ? 'radio' : 'checkbox'}
                        accessibilityState={{ checked: picked }}
                        accessibilityLabel={c}
                        onPress={() => choose(q, String(ci))}
                        style={({ pressed }) => [
                          styles.option,
                          picked && { borderColor: brand.primary, backgroundColor: brand.infoBg },
                          pressed && { opacity: 0.8 },
                        ]}
                      >
                        <View
                          style={[
                            styles.letter,
                            { backgroundColor: brand.infoBg },
                            picked && { backgroundColor: brand.primary },
                          ]}
                        >
                          <AppText
                            variant="caption"
                            style={{ color: picked ? colors.onPrimary : brand.primary }}
                          >
                            {String.fromCharCode(65 + (ci % 26))}
                          </AppText>
                        </View>
                        <AppText style={styles.choice}>{c}</AppText>
                        <View
                          style={[
                            styles.mark,
                            single ? styles.markRound : styles.markSquare,
                            picked && {
                              backgroundColor: brand.primary,
                              borderColor: brand.primary,
                            },
                          ]}
                        >
                          {picked ? (
                            <AppText variant="caption" style={{ color: colors.onPrimary }}>
                              ✓
                            </AppText>
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })
                )}
              </Card>
            );
          })}
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
  progress: { gap: spacing.sm, padding: spacing.lg },
  question: { gap: spacing.md, padding: spacing.lg },
  questionText: { fontFamily: fonts.heading, fontSize: 18, lineHeight: 25, color: colors.text },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: minTouchTarget + spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
  },
  letter: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.infoBg,
  },
  choice: { flex: 1 },
  mark: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  markRound: { borderRadius: 13 },
  markSquare: { borderRadius: 7 },
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
    boxShadow: shadows.inset,
  },
});

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import type { TalaRoutes } from '../routes';
import { AppText, Button, Card, ErrorState, Notice, ProgressBar } from '../ui';
import { colors, fonts, radius, shadows, spacing } from '../ui/theme';
import { FlashcardsSkeleton } from './TalaSkeletons';
import { describeError, toApiError } from '../errors';
import type { TalaDeck } from '../types';
import { scopedKey } from '../runtime';
import { fetchTalaDeck } from '../data/api';
import { queueFlashcards, syncOutbox } from '../offline/outbox';
import { currentScope } from '../offline/paths';
import { getCachedDeck, getLocalRatings, setCachedDeck, setLocalRatings } from '../offline/store';
import { useBrand } from '../ui/brand';

type Props = NativeStackScreenProps<TalaRoutes, 'TalaFlashcards'>;
type Rating = 'easy' | 'medium' | 'hard';
type DeckCard = TalaDeck['cards'][number];

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** First pass: cards not rated yet, in random order. Practice pass: everything, hardest first (as the Tala app favours hard cards). */
function planPass(
  deck: TalaDeck,
  ratings: Record<number, Rating>,
): { order: number[]; practice: boolean } {
  const unrated = deck.cards.filter((c) => ratings[c.index] === undefined).map((c) => c.index);
  if (unrated.length > 0) return { order: shuffle(unrated), practice: false };
  const bucket = (r: Rating) =>
    deck.cards.filter((c) => ratings[c.index] === r).map((c) => c.index);
  return {
    order: [...shuffle(bucket('hard')), ...shuffle(bucket('medium')), ...shuffle(bucket('easy'))],
    practice: true,
  };
}

function Media({ media, label }: { media: DeckCard['question_media']; label: string }) {
  if (!media) return null;
  if (media.type === 'image') {
    return (
      <Image
        source={{ uri: media.url }}
        accessibilityLabel={label}
        resizeMode="contain"
        style={styles.image}
      />
    );
  }
  return (
    <Button
      title={media.type === 'video' ? 'Play video' : 'Play audio'}
      variant="secondary"
      onPress={() => void Linking.openURL(media.url)}
    />
  );
}

/**
 * Flashcard study. Self-assessed: show the answer, then rate the card Easy / Medium / Hard. Like the Tala app, results are
 * recorded when EVERY card has been rated; progress until then stays on this device. The deck is kept for offline study
 * (card pictures and media still need a connection).
 */
export function TalaFlashcardsScreen({ route, navigation }: Props) {
  const { assignId, cardId } = route.params;
  const deckQuery = useQuery({
    queryKey: scopedKey('tala', 'deck', assignId, cardId),
    gcTime: 0,
    staleTime: 0,
    queryFn: async () => {
      const scope = currentScope();
      let deck: TalaDeck;
      let fromCache = false;
      try {
        deck = await fetchTalaDeck(assignId, cardId);
        await setCachedDeck(scope, assignId, cardId, { fetchedAt: new Date().toISOString(), deck });
      } catch (e) {
        const err = toApiError(e);
        const cached =
          err.kind === 'network' || (err.status ?? 0) >= 500
            ? await getCachedDeck(scope, assignId, cardId)
            : null;
        if (!cached) throw e;
        deck = cached.deck;
        fromCache = true;
      }
      // Ratings: what Tala already holds, then this device's newer progress for the same version of the deck.
      const ratings: Record<number, Rating> = {};
      for (const c of deck.cards) if (c.rating) ratings[c.index] = c.rating;
      const local = await getLocalRatings(scope, assignId, cardId);
      if (local && local.version === deck.version) {
        for (const [i, r] of Object.entries(local.ratings)) ratings[Number(i)] = r;
      }
      return { deck, fromCache, ratings };
    },
  });

  if (deckQuery.isError) {
    return (
      <ErrorState
        message={describeError(deckQuery.error)}
        onRetry={() => void deckQuery.refetch()}
      />
    );
  }
  const data = deckQuery.data;
  if (!data) return <FlashcardsSkeleton />;

  return (
    <Study
      assignId={assignId}
      cardId={cardId}
      deck={data.deck}
      fromCache={data.fromCache}
      initialRatings={data.ratings}
      previewAnswer={false}
      onBack={() => navigation.goBack()}
    />
  );
}

function Study({
  assignId,
  cardId,
  deck,
  fromCache,
  initialRatings,
  previewAnswer,
  onBack,
}: {
  assignId: string;
  cardId: string;
  deck: TalaDeck;
  fromCache: boolean;
  initialRatings: Record<number, Rating>;
  previewAnswer: boolean;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState(() => {
    const plan = planPass(deck, initialRatings);
    return { ratings: initialRatings, order: plan.order, pos: 0, practice: plan.practice };
  });
  const [revealed, setRevealed] = useState(previewAnswer);
  // The back face keeps the card it was turned over on, so it can swing away while the next question swings in.
  const [backIndex, setBackIndex] = useState<number | null>(null); // null: the current card
  const [done, setDone] = useState(false);
  const [flip] = useState(() => new Animated.Value(previewAnswer ? 1 : 0));
  const reduceMotion = useRef(false);
  const { height } = useWindowDimensions();

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled?.()
      .then((on) => {
        reduceMotion.current = on;
      })
      .catch(() => undefined);
  }, []);

  /** Turns the card over (1 = answer side) or back (0 = question side). Skipped for people who asked for less motion. */
  function turn(to: 0 | 1) {
    if (reduceMotion.current) {
      flip.setValue(to);
      return;
    }
    Animated.timing(flip, {
      toValue: to,
      duration: 480,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }

  function reveal(card: DeckCard) {
    setBackIndex(card.index);
    setRevealed(true);
    turn(1);
  }
  const [error, setError] = useState<string | null>(null);

  const rated = Object.keys(session.ratings).length;
  const counts = { easy: 0, medium: 0, hard: 0 };
  for (const r of Object.values(session.ratings)) counts[r]++;

  async function finish(ratings: Record<number, Rating>) {
    setDone(true);
    try {
      await queueFlashcards(
        assignId,
        cardId,
        deck.version,
        deck.cards.map((c) => ({ index: c.index, rating: ratings[c.index]! })),
      );
      const r = await syncOutbox();
      await queryClient.invalidateQueries({ queryKey: scopedKey('tala', 'outbox') });
      if (r.dropped > 0) setError('This set could not be sent. Please study it again.');
    } catch (e) {
      setError(describeError(e));
    }
  }

  async function rate(card: DeckCard, rating: Rating) {
    const ratings = { ...session.ratings, [card.index]: rating };
    await setLocalRatings(currentScope(), assignId, cardId, { version: deck.version, ratings });
    setRevealed(false);
    turn(0);
    const pos = session.pos + 1;
    if (pos >= session.order.length) {
      setSession({ ...session, ratings, pos });
      if (Object.keys(ratings).length === deck.cards.length) await finish(ratings);
      return;
    }
    setSession({ ...session, ratings, pos });
  }

  function again() {
    const plan = planPass(deck, session.ratings);
    setDone(false);
    setError(null);
    setRevealed(false);
    flip.setValue(0);
    setSession({ ...session, order: plan.order, pos: 0, practice: plan.practice });
  }

  if (done || session.pos >= session.order.length) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="title" accessibilityRole="header">
          {rated === deck.cards.length ? 'All cards rated' : 'Session finished'}
        </AppText>
        <Card style={{ gap: spacing.sm }}>
          <AppText variant="heading">{deck.name}</AppText>
          <View style={styles.ratings} accessibilityElementsHidden>
            <ResultTile n={counts.easy} label="Easy" bg={colors.successBg} fg={colors.success} />
            <ResultTile
              n={counts.medium}
              label="Medium"
              bg={colors.warningBg}
              fg={colors.warning}
            />
            <ResultTile n={counts.hard} label="Hard" bg={colors.dangerBg} fg={colors.danger} />
          </View>
          <AppText>
            Easy {counts.easy} · Medium {counts.medium} · Hard {counts.hard}
          </AppText>
          <AppText muted>
            {rated === deck.cards.length
              ? 'Your results are sent to Lodestar. If you are offline they are sent when you are back online.'
              : `${rated} of ${deck.cards.length} cards rated. Rate every card to record this set.`}
          </AppText>
        </Card>
        {error ? <Notice tone="warning" message={error} /> : null}
        <Button
          title={rated === deck.cards.length ? 'Practice again' : 'Continue'}
          variant="secondary"
          onPress={again}
        />
        <Button title="Back to course" onPress={() => onBack()} />
      </ScrollView>
    );
  }

  const card = deck.cards[session.order[session.pos]!]!;
  const back = deck.cards.find((c) => c.index === backIndex) ?? card;
  const frontTurn = flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backTurn = flip.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });
  const cardHeight = Math.max(320, Math.round(height * 0.5));

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card variant="flat" style={styles.progress}>
        <AppText variant="caption" muted>
          Card {session.pos + 1} of {session.order.length} · Rated {rated} of {deck.cards.length}
          {session.practice ? ' · Practice' : ''}
        </AppText>
        <ProgressBar
          percent={deck.cards.length === 0 ? 0 : (rated / deck.cards.length) * 100}
          label={`${rated} of ${deck.cards.length} cards rated`}
        />
      </Card>
      {fromCache ? <Notice message="You are studying the copy saved on this device." /> : null}

      <View style={{ height: cardHeight, marginVertical: spacing.sm }}>
        <Face
          title="Question"
          text={card.question}
          media={card.question_media}
          mediaLabel="Question picture"
          turn={frontTurn}
          hidden={revealed}
        />
        <Face
          title="Answer"
          text={back.answer}
          media={back.answer_media}
          mediaLabel="Answer picture"
          turn={backTurn}
          hidden={!revealed}
          accent
        />
      </View>

      {revealed ? (
        <>
          <AppText muted style={styles.center}>
            How well did you know it?
          </AppText>
          <View style={styles.ratings}>
            <RatingButton
              label="Easy"
              bg={colors.successBg}
              fg={colors.success}
              onPress={() => void rate(card, 'easy')}
            />
            <RatingButton
              label="Medium"
              bg={colors.warningBg}
              fg={colors.warning}
              onPress={() => void rate(card, 'medium')}
            />
            <RatingButton
              label="Hard"
              bg={colors.dangerBg}
              fg={colors.danger}
              onPress={() => void rate(card, 'hard')}
            />
          </View>
        </>
      ) : (
        <Button title="Show answer" onPress={() => reveal(card)} />
      )}
    </ScrollView>
  );
}

/** One side of the card. A side that is not facing the learner is hidden from screen readers (and from taps). */
function Face({
  title,
  text,
  media,
  mediaLabel,
  turn,
  hidden,
  accent,
}: {
  title: string;
  text: string | null;
  media: DeckCard['question_media'];
  mediaLabel: string;
  turn: Animated.AnimatedInterpolation<string>;
  hidden: boolean;
  accent?: boolean;
}) {
  const brand = useBrand();
  return (
    <Animated.View
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      pointerEvents={hidden ? 'none' : 'auto'}
      style={[
        styles.face,
        accent && styles.faceAccent,
        { transform: [{ perspective: 2600 }, { rotateY: turn }] },
      ]}
    >
      <View
        style={[styles.faceChip, { backgroundColor: accent ? colors.successBg : brand.infoBg }]}
      >
        <AppText variant="caption" style={{ color: accent ? colors.success : brand.primary }}>
          {title}
        </AppText>
      </View>
      <ScrollView contentContainerStyle={styles.faceBody} showsVerticalScrollIndicator={false}>
        {text ? (
          <AppText variant="heading" style={[styles.center, styles.faceText]}>
            {text}
          </AppText>
        ) : null}
        <Media media={media} label={mediaLabel} />
      </ScrollView>
    </Animated.View>
  );
}

function ResultTile({ n, label, bg, fg }: { n: number; label: string; bg: string; fg: string }) {
  return (
    <View style={[styles.resultTile, { backgroundColor: bg }]}>
      <AppText style={{ fontFamily: fonts.heading, fontSize: 24, lineHeight: 30, color: fg }}>
        {n}
      </AppText>
      <AppText variant="caption" style={{ color: fg }}>
        {label}
      </AppText>
    </View>
  );
}

/** One of the three ratings, as a tinted pill. */
function RatingButton({
  label,
  bg,
  fg,
  onPress,
}: {
  label: string;
  bg: string;
  fg: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.rating,
        { backgroundColor: bg, borderColor: fg },
        pressed && { opacity: 0.8 },
      ]}
    >
      <AppText variant="button" maxFontSizeMultiplier={1.5} style={{ color: fg }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  center: { textAlign: 'center' },
  progress: { gap: spacing.sm, padding: spacing.lg, zIndex: 2 },
  resultTile: {
    flex: 1,
    alignItems: 'center',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  ratings: { flexDirection: 'row', gap: spacing.md },
  rating: {
    flex: 1,
    minHeight: 56,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceChip: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
  },
  faceText: { fontSize: 22, lineHeight: 30 },
  face: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backfaceVisibility: 'hidden',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
    padding: spacing.xl,
    gap: spacing.md,
    boxShadow: shadows.raised,
  },
  faceAccent: { backgroundColor: colors.successBg, borderColor: colors.success },
  faceBody: { flexGrow: 1, justifyContent: 'center', alignItems: 'stretch', gap: spacing.md },
  image: {
    width: '100%',
    height: 220,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSunken,
  },
});

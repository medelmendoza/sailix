import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Image, Linking, ScrollView, StyleSheet } from 'react-native';
import type { AppStackParamList } from '@/app/navigation/types';
import { AppText, Button, Card, ErrorState, Notice, SkeletonList } from '@/components';
import { colors, radius, spacing } from '@/constants/theme';
import { describeError, toApiError } from '@/services/api/errors';
import type { TalaDeck } from '@/services/api/types';
import { scopedKey } from '@/store/scopedKey';
import { fetchTalaDeck } from './api';
import { queueFlashcards, syncOutbox } from './offline/outbox';
import { currentScope } from './offline/paths';
import { getCachedDeck, getLocalRatings, setCachedDeck, setLocalRatings } from './offline/store';

type Props = NativeStackScreenProps<AppStackParamList, 'TalaFlashcards'>;
type Rating = 'easy' | 'medium' | 'hard';
type DeckCard = TalaDeck['cards'][number];

const LABEL: Record<Rating, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

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
  if (!data) return <SkeletonList />;

  return (
    <Study
      assignId={assignId}
      cardId={cardId}
      deck={data.deck}
      fromCache={data.fromCache}
      initialRatings={data.ratings}
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
  onBack,
}: {
  assignId: string;
  cardId: string;
  deck: TalaDeck;
  fromCache: boolean;
  initialRatings: Record<number, Rating>;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState(() => {
    const plan = planPass(deck, initialRatings);
    return { ratings: initialRatings, order: plan.order, pos: 0, practice: plan.practice };
  });
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(false);
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
          <AppText>
            Easy {counts.easy} · Medium {counts.medium} · Hard {counts.hard}
          </AppText>
          <AppText muted>
            {rated === deck.cards.length
              ? 'Your results are sent to Tala. If you are offline they are sent when you are back online.'
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
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <AppText variant="caption" muted>
        Card {session.pos + 1} of {session.order.length} · Rated {rated} of {deck.cards.length}
        {session.practice ? ' · Practice' : ''}
      </AppText>
      {fromCache ? <Notice message="You are studying the copy saved on this device." /> : null}
      <Card style={{ gap: spacing.md }}>
        <AppText variant="caption" muted>
          Question
        </AppText>
        {card.question ? <AppText variant="heading">{card.question}</AppText> : null}
        <Media media={card.question_media} label="Question picture" />
      </Card>
      {revealed ? (
        <>
          <Card style={{ gap: spacing.md }}>
            <AppText variant="caption" muted>
              Answer
            </AppText>
            {card.answer ? <AppText variant="heading">{card.answer}</AppText> : null}
            <Media media={card.answer_media} label="Answer picture" />
          </Card>
          <AppText muted>How well did you know it?</AppText>
          {(['easy', 'medium', 'hard'] as const).map((r) => (
            <Button
              key={r}
              title={LABEL[r]}
              variant={r === 'hard' ? 'secondary' : 'primary'}
              onPress={() => void rate(card, r)}
            />
          ))}
        </>
      ) : (
        <Button title="Show answer" onPress={() => setRevealed(true)} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  image: {
    width: '100%',
    height: 220,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSunken,
  },
});

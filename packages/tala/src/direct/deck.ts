import { fingerprint, isObject, type Json } from './mapping';
import { invalid } from './problem';

/**
 * A Tala flashcard set ("up_card"): a port of TalaDeck.php. Cards are self-assessed (there is no answer key); what this
 * owns is the shape written back: a deck row is written only when EVERY card has been rated, with Tala's own counters
 * and per-card result values. Anything not understood is refused as `unsupported_deck`.
 */
const MAX_CARDS = 500;
const RESULTS = { easy: 'EASY', medium: 'MEDIUM', hard: 'HARD' } as const;
type Rating = keyof typeof RESULTS;

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.slice(0, 4000) : null);
const unsupported = () => invalid('unsupported_deck', 'This flashcard set cannot be studied in this version of the app.');

/** Only an https address is passed on. */
function media(type: unknown, url: unknown): { type: string; url: string } | null {
  const u = str(url);
  if (u === null || !/^https:\/\//i.test(u) || u.length > 2000) return null;
  try {
    new URL(u);
  } catch {
    return null;
  }
  const t = String(type ?? '').toLowerCase();
  return { type: ['image', 'video', 'audio'].includes(t) ? t : 'image', url: u };
}

export function parseDeck(raw: Json) {
  const id = typeof raw.cardId === 'string' ? raw.cardId : null;
  const data = raw.data;
  if (id === null || !Array.isArray(data) || data.length === 0 || data.length > MAX_CARDS) throw unsupported();
  const cards: Json[] = data.map((c: unknown) => {
    // a card needs something to ask and something to reveal (text or media)
    if (!isObject(c) || (str(c.question) === null && str(c.questionMediaUploaded) === null) || (str(c.answer) === null && str(c.answerMediaUploaded) === null)) {
      throw unsupported();
    }
    return c;
  });
  const name = String(raw.cardName ?? '');
  const description = str(raw.cardDescription);
  const version = () => fingerprint(cards.map((c) => [c.question ?? '', c.answer ?? '', c.questionMediaUploaded ?? '', c.answerMediaUploaded ?? '']));

  /** The deck changed since the ratings were stored: do not apply them to the wrong cards. */
  function storedRatings(row: Json | null): (Rating | null)[] {
    const rows = row && Array.isArray(row.data) ? row.data : [];
    if (row === null || rows.length !== cards.length) return [];
    return rows.map((item: unknown) => {
      const r = isObject(item) ? String(item.result ?? '').toLowerCase() : '';
      return r in RESULTS ? (r as Rating) : null;
    });
  }

  return {
    id,
    name,
    description,
    version,
    size: cards.length,

    publicView(storedRow: Json | null) {
      const stored = storedRatings(storedRow);
      return {
        id,
        name,
        description,
        version: version(),
        cards: cards.map((c, index) => ({
          index,
          question: str(c.question),
          question_media: media(c.questionMediaType, c.questionMediaUploaded),
          answer: str(c.answer),
          answer_media: media(c.answerMediaType, c.answerMediaUploaded),
          rating: stored[index] ?? null,
        })),
      };
    },

    /** [{index, rating}] covering every card exactly once, returned in card order. */
    validateRatings(ratings: unknown[]): Rating[] {
      const out: Rating[] = [];
      const seen = new Set<number>();
      for (const r of ratings) {
        const i = isObject(r) ? r.index : null;
        const rating = isObject(r) ? r.rating : null;
        if (typeof i !== 'number' || !Number.isInteger(i) || i < 0 || i >= cards.length || seen.has(i) || typeof rating !== 'string' || !(rating in RESULTS)) {
          throw invalid('invalid_ratings', 'Each card must be rated exactly once as easy, medium or hard.');
        }
        seen.add(i);
        out[i] = rating as Rating;
      }
      if (seen.size !== cards.length) throw invalid('incomplete_ratings', 'Rate every card before sending.');
      return out;
    },

    /** The deck row for Tala's sync payload, in the shape the Tala app itself posts. */
    syncRow(ratings: Rating[]): Json {
      const count = (r: Rating) => ratings.filter((x) => x === r).length;
      return {
        cardId: id,
        cardName: name,
        cardDescription: description ?? '',
        cardThumbnailUrl: str(raw.cardThumbnailUrl) ?? '',
        status: 'COMPLETED',
        notseen: 0,
        easy: count('easy'),
        medium: count('medium'),
        hard: count('hard'),
        progress: '',
        tags: str(raw.tags) ?? '',
        data: cards.map((c, i) => ({
          tags: str(c.tags) ?? '',
          question: str(c.question) ?? '',
          answer: str(c.answer) ?? '',
          questionMediaType: str(c.questionMediaType) ?? '',
          questionMediaUploaded: str(c.questionMediaUploaded) ?? '',
          answerMediaType: str(c.answerMediaType) ?? '',
          answerMediaUploaded: str(c.answerMediaUploaded) ?? '',
          result: RESULTS[ratings[i]!],
        })),
      };
    },
  };
}

export type ParsedDeck = ReturnType<typeof parseDeck>;

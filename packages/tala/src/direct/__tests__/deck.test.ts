import { parseDeck } from '../deck';
import { TalaProblem } from '../problem';
import { deckDoc } from '../testing/fixtures';

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as TalaProblem).code;
  }
  return null;
};

describe('flashcard deck', () => {
  it('delivers the cards and resumes the ratings already stored for them', () => {
    const view = parseDeck(deckDoc()).publicView({ cardId: 'c1', data: [{ result: 'HARD' }, { result: 'NOT SEEN' }] });
    expect(view.cards.map((c) => c.question)).toEqual(['Bowline?', 'Reef knot?']);
    expect(view.cards.map((c) => c.rating)).toEqual(['hard', null]);
    expect(view.cards[0]?.question_media).toEqual({ type: 'image', url: 'https://cdn.example.com/b.png' });
    expect(view.cards[1]?.question_media).toBeNull();
  });

  it('does not apply stored ratings to a deck that has changed size', () => {
    expect(parseDeck(deckDoc()).publicView({ data: [{ result: 'HARD' }] }).cards.map((c) => c.rating)).toEqual([null, null]);
  });

  it('only passes on https media', () => {
    const doc = deckDoc();
    (doc.data as { questionMediaUploaded: string }[])[0]!.questionMediaUploaded = 'http://x.example.com/b.png';
    expect(parseDeck(doc).publicView(null).cards[0]?.question_media).toBeNull();
  });

  it('accepts a complete set of ratings in any order and writes the row Tala stores', () => {
    const d = parseDeck(deckDoc());
    const valid = d.validateRatings([
      { index: 1, rating: 'hard' },
      { index: 0, rating: 'easy' },
    ]);
    expect(valid).toEqual(['easy', 'hard']);
    const row = d.syncRow(valid);
    expect(row).toMatchObject({ cardId: 'c1', status: 'COMPLETED', notseen: 0, easy: 1, medium: 0, hard: 1 });
    expect((row.data as { result: string }[]).map((r) => r.result)).toEqual(['EASY', 'HARD']);
  });

  it('refuses incomplete, duplicate, out-of-range and unknown ratings', () => {
    const d = parseDeck(deckDoc());
    expect(code(() => d.validateRatings([{ index: 0, rating: 'easy' }]))).toBe('incomplete_ratings');
    expect(code(() => d.validateRatings([{ index: 0, rating: 'easy' }, { index: 0, rating: 'hard' }]))).toBe('invalid_ratings');
    expect(code(() => d.validateRatings([{ index: 0, rating: 'easy' }, { index: 5, rating: 'hard' }]))).toBe('invalid_ratings');
    expect(code(() => d.validateRatings([{ index: 0, rating: 'easy' }, { index: 1, rating: 'meh' }]))).toBe('invalid_ratings');
    expect(code(() => d.validateRatings([{ index: '0', rating: 'easy' }, { index: 1, rating: 'hard' }]))).toBe('invalid_ratings');
  });

  it('refuses a deck it does not understand', () => {
    expect(code(() => parseDeck({ cardId: 'c', data: [] }))).toBe('unsupported_deck');
    expect(code(() => parseDeck({ cardId: 'c', data: [{ question: 'q' }] }))).toBe('unsupported_deck');
    expect(code(() => parseDeck({ data: [{}] }))).toBe('unsupported_deck');
  });

  it('changes its version when a card changes', () => {
    const a = parseDeck(deckDoc()).version();
    const doc = deckDoc();
    (doc.data as { answer: string }[])[1]!.answer = 'Other';
    expect(parseDeck(doc).version()).not.toBe(a);
  });
});

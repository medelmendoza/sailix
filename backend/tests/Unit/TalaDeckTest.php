<?php

namespace Tests\Unit;

use App\Modules\Tala\TalaDeck;
use App\Support\ApiProblem;
use PHPUnit\Framework\TestCase;

class TalaDeckTest extends TestCase
{
    private function raw(?array $cards = null, array $over = []): array
    {
        $cards ??= [
            ['tags' => '', 'question' => 'Q one', 'questionMediaType' => 'image', 'questionMediaUploaded' => 'https://cdn.example.com/q1.png', 'answer' => 'A one', 'answerMediaType' => '', 'answerMediaUploaded' => ''],
            ['tags' => 't', 'question' => 'Q two', 'questionMediaType' => '', 'questionMediaUploaded' => '', 'answer' => 'A two', 'answerMediaType' => 'audio', 'answerMediaUploaded' => 'http://insecure.example.com/a.mp3'],
            ['tags' => '', 'question' => '', 'questionMediaType' => 'image', 'questionMediaUploaded' => 'https://cdn.example.com/q3.png', 'answer' => 'A three', 'answerMediaType' => '', 'answerMediaUploaded' => ''],
        ];

        return $over + ['cardId' => 'c1', 'cardName' => 'Deck', 'cardDescription' => 'desc', 'cardThumbnailUrl' => 'https://cdn.example.com/t.png', 'tags' => 'x', 'data' => $cards];
    }

    private function code(callable $f): string
    {
        try {
            $f();
        } catch (ApiProblem $e) {
            return $e->problemCode;
        }

        return 'none';
    }

    public function test_the_public_view_has_cards_media_over_https_only_and_no_internal_fields(): void
    {
        $view = TalaDeck::parse($this->raw())->publicView(null);

        $this->assertSame(['id', 'name', 'description', 'version', 'cards'], array_keys($view));
        $this->assertCount(3, $view['cards']);
        $this->assertSame(['index', 'question', 'question_media', 'answer', 'answer_media', 'rating'], array_keys($view['cards'][0]));
        $this->assertSame(['type' => 'image', 'url' => 'https://cdn.example.com/q1.png'], $view['cards'][0]['question_media']);
        $this->assertNull($view['cards'][1]['answer_media']);          // http:// address is not passed on
        $this->assertNull($view['cards'][2]['question']);               // media-only question is allowed
        $this->assertNull($view['cards'][0]['rating']);
    }

    public function test_stored_ratings_resume_only_when_the_deck_is_unchanged(): void
    {
        $deck = TalaDeck::parse($this->raw());
        $row = ['cardId' => 'c1', 'data' => [['result' => 'HARD'], ['result' => 'NOT SEEN'], ['result' => 'easy']]];

        $this->assertSame(['hard', null, 'easy'], array_column($deck->publicView($row)['cards'], 'rating'));
        $this->assertSame([null, null, null], array_column($deck->publicView(['data' => [['result' => 'HARD']]])['cards'], 'rating')); // size differs: ignored
        $this->assertSame([null, null, null], array_column($deck->publicView(['data' => 'garbage'])['cards'], 'rating'));
    }

    public function test_version_changes_with_the_content(): void
    {
        $a = TalaDeck::parse($this->raw())->version();
        $cards = $this->raw()['data'];
        $cards[0]['answer'] = 'Changed';

        $this->assertSame($a, TalaDeck::parse($this->raw())->version());
        $this->assertNotSame($a, TalaDeck::parse($this->raw($cards))->version());
    }

    public function test_ratings_must_cover_every_card_exactly_once_with_a_known_value(): void
    {
        $deck = TalaDeck::parse($this->raw());
        $ok = [['index' => 2, 'rating' => 'hard'], ['index' => 0, 'rating' => 'easy'], ['index' => 1, 'rating' => 'medium']];

        $this->assertSame([0 => 'easy', 1 => 'medium', 2 => 'hard'], $deck->validateRatings($ok));
        $this->assertSame('incomplete_ratings', $this->code(fn () => $deck->validateRatings(array_slice($ok, 0, 2))));
        $this->assertSame('invalid_ratings', $this->code(fn () => $deck->validateRatings([...$ok, ['index' => 0, 'rating' => 'easy']])));
        $this->assertSame('invalid_ratings', $this->code(fn () => $deck->validateRatings([['index' => 3, 'rating' => 'easy'], ...array_slice($ok, 1)])));
        $this->assertSame('invalid_ratings', $this->code(fn () => $deck->validateRatings([['index' => 0, 'rating' => 'EASY'], ...array_slice($ok, 1)])));
        $this->assertSame('invalid_ratings', $this->code(fn () => $deck->validateRatings([['index' => '0', 'rating' => 'easy'], ...array_slice($ok, 1)])));
        $this->assertSame('invalid_ratings', $this->code(fn () => $deck->validateRatings(['x'])));
        $this->assertSame('invalid_ratings', $this->code(fn () => $deck->validateRatings([['index' => -1, 'rating' => 'easy'], ...array_slice($ok, 1)])));
    }

    public function test_the_row_written_to_tala_has_tala_own_counters_and_result_values(): void
    {
        $deck = TalaDeck::parse($this->raw());
        $row = $deck->syncRow($deck->validateRatings([['index' => 0, 'rating' => 'easy'], ['index' => 1, 'rating' => 'hard'], ['index' => 2, 'rating' => 'hard']]));

        $this->assertSame(['COMPLETED', 0, 1, 0, 2, ''], [$row['status'], $row['notseen'], $row['easy'], $row['medium'], $row['hard'], $row['progress']]);
        $this->assertSame(['EASY', 'HARD', 'HARD'], array_column($row['data'], 'result'));
        $this->assertSame('Q one', $row['data'][0]['question']);                         // card text comes from Tala's deck
        $this->assertSame('http://insecure.example.com/a.mp3', $row['data'][1]['answerMediaUploaded']); // stored as Tala has it
        $this->assertSame('c1', $row['cardId']);
        $this->assertSame(['tags', 'question', 'answer', 'questionMediaType', 'questionMediaUploaded', 'answerMediaType', 'answerMediaUploaded', 'result'], array_keys($row['data'][0]));
    }

    public function test_decks_that_cannot_be_represented_are_refused(): void
    {
        $this->assertSame('unsupported_deck', $this->code(fn () => TalaDeck::parse(['cardId' => 'c'])));
        $this->assertSame('unsupported_deck', $this->code(fn () => TalaDeck::parse($this->raw([]))));
        $this->assertSame('unsupported_deck', $this->code(fn () => TalaDeck::parse($this->raw(array_fill(0, 501, ['question' => 'q', 'answer' => 'a'])))));
        $this->assertSame('unsupported_deck', $this->code(fn () => TalaDeck::parse($this->raw([['question' => 'q']]))));          // nothing to reveal
        $this->assertSame('unsupported_deck', $this->code(fn () => TalaDeck::parse($this->raw([['answer' => 'a']]))));            // nothing to ask
        $this->assertSame('unsupported_deck', $this->code(fn () => TalaDeck::parse($this->raw(null, ['cardId' => 5]))));
    }
}

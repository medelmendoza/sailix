<?php

namespace App\Modules\Tala;

use App\Support\ApiProblem;

/**
 * A Tala flashcard set ("up_card"), parsed for the gateway. Cards are self-assessed study material (there is no answer
 * key to protect), so the deck is delivered in full; what the server owns is the shape of what gets written back:
 * a deck row is written only when EVERY card has been rated (as the Tala app does: only completed items are synced),
 * with Tala's own counters and per-card result values. Anything it does not understand is refused as `unsupported_deck`.
 */
final class TalaDeck
{
    private const MAX_CARDS = 500;

    private const RESULTS = ['easy' => 'EASY', 'medium' => 'MEDIUM', 'hard' => 'HARD'];

    /**
     * @param  array<string, mixed>  $raw  Tala's deck document
     * @param  list<array<string, mixed>>  $cards  normalized cards
     */
    private function __construct(
        public readonly string $id,
        public readonly string $name,
        public readonly ?string $description,
        private array $raw,
        private array $cards,
    ) {}

    /** @param array<string, mixed> $raw */
    public static function parse(array $raw): self
    {
        $id = is_string($raw['cardId'] ?? null) ? $raw['cardId'] : null;
        $data = $raw['data'] ?? null;
        if ($id === null || ! is_array($data) || $data === [] || count($data) > self::MAX_CARDS) {
            throw self::unsupported();
        }
        $cards = [];
        foreach (array_values($data) as $i => $c) {
            $question = is_array($c) ? self::str($c['question'] ?? null) : null;
            $answer = is_array($c) ? self::str($c['answer'] ?? null) : null;
            // a card needs something to ask and something to reveal (text or media)
            if (! is_array($c) || ($question === null && self::str($c['questionMediaUploaded'] ?? null) === null) || ($answer === null && self::str($c['answerMediaUploaded'] ?? null) === null)) {
                throw self::unsupported();
            }
            $cards[] = ['index' => $i, 'source' => $c];
        }

        return new self($id, (string) ($raw['cardName'] ?? ''), self::str($raw['cardDescription'] ?? null), $raw, $cards);
    }

    /**
     * @param  array<string, mixed>|null  $storedRow  Tala's stored row for this deck in the user's snapshot (to resume ratings)
     * @return array<string, mixed>
     */
    public function publicView(?array $storedRow): array
    {
        $stored = $this->storedRatings($storedRow);

        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'version' => $this->version(),
            'cards' => array_map(fn (array $c) => [
                'index' => $c['index'],
                'question' => self::str($c['source']['question'] ?? null),
                'question_media' => self::media($c['source']['questionMediaType'] ?? null, $c['source']['questionMediaUploaded'] ?? null),
                'answer' => self::str($c['source']['answer'] ?? null),
                'answer_media' => self::media($c['source']['answerMediaType'] ?? null, $c['source']['answerMediaUploaded'] ?? null),
                'rating' => $stored[$c['index']] ?? null,
            ], $this->cards),
        ];
    }

    public function version(): string
    {
        return substr(sha1((string) json_encode(array_map(fn (array $c) => [$c['source']['question'] ?? '', $c['source']['answer'] ?? '', $c['source']['questionMediaUploaded'] ?? '', $c['source']['answerMediaUploaded'] ?? ''], $this->cards))), 0, 16);
    }

    public function size(): int
    {
        return count($this->cards);
    }

    /**
     * @param  list<mixed>  $ratings  [{index, rating}] covering every card exactly once
     * @return array<int, string> index => 'easy'|'medium'|'hard'
     */
    public function validateRatings(array $ratings): array
    {
        $out = [];
        foreach ($ratings as $r) {
            $i = is_array($r) ? ($r['index'] ?? null) : null;
            $rating = is_array($r) ? ($r['rating'] ?? null) : null;
            if (! is_int($i) || $i < 0 || $i >= $this->size() || isset($out[$i]) || ! is_string($rating) || ! isset(self::RESULTS[$rating])) {
                throw ApiProblem::invalid('invalid_ratings', 'Each card must be rated exactly once as easy, medium or hard.');
            }
            $out[$i] = $rating;
        }
        if (count($out) !== $this->size()) {
            throw ApiProblem::invalid('incomplete_ratings', 'Rate every card before sending.');
        }
        ksort($out);

        return $out;
    }

    /**
     * The deck row for Tala's sync payload, in the shape the Tala app itself posts.
     *
     * @param  array<int, string>  $ratings
     * @return array<string, mixed>
     */
    public function syncRow(array $ratings): array
    {
        $counts = ['easy' => 0, 'medium' => 0, 'hard' => 0];
        foreach ($ratings as $r) {
            $counts[$r]++;
        }

        return [
            'cardId' => $this->id,
            'cardName' => $this->name,
            'cardDescription' => $this->description ?? '',
            'cardThumbnailUrl' => self::str($this->raw['cardThumbnailUrl'] ?? null) ?? '',
            'status' => 'COMPLETED',
            'notseen' => 0,
            'easy' => $counts['easy'],
            'medium' => $counts['medium'],
            'hard' => $counts['hard'],
            'progress' => '',
            'tags' => self::str($this->raw['tags'] ?? null) ?? '',
            'data' => array_map(fn (array $c) => [
                'tags' => self::str($c['source']['tags'] ?? null) ?? '',
                'question' => self::str($c['source']['question'] ?? null) ?? '',
                'answer' => self::str($c['source']['answer'] ?? null) ?? '',
                'questionMediaType' => self::str($c['source']['questionMediaType'] ?? null) ?? '',
                'questionMediaUploaded' => self::str($c['source']['questionMediaUploaded'] ?? null) ?? '',
                'answerMediaType' => self::str($c['source']['answerMediaType'] ?? null) ?? '',
                'answerMediaUploaded' => self::str($c['source']['answerMediaUploaded'] ?? null) ?? '',
                'result' => self::RESULTS[$ratings[$c['index']]],
            ], $this->cards),
        ];
    }

    /**
     * @param  array<string, mixed>|null  $row
     * @return array<int, string>
     */
    private function storedRatings(?array $row): array
    {
        $data = is_array($row['data'] ?? null) ? array_values($row['data']) : [];
        if ($row === null || count($data) !== count($this->cards)) {
            return []; // the deck changed since the ratings were stored: do not apply them to the wrong cards
        }
        $out = [];
        foreach ($data as $i => $item) {
            $result = is_array($item) ? strtolower((string) ($item['result'] ?? '')) : '';
            if (isset(self::RESULTS[$result])) {
                $out[$i] = $result;
            }
        }

        return $out;
    }

    /** @return array{type: string, url: string}|null only an https address is passed on */
    private static function media(mixed $type, mixed $url): ?array
    {
        $u = self::str($url);
        if ($u === null || ! str_starts_with(strtolower($u), 'https://') || filter_var($u, FILTER_VALIDATE_URL) === false || strlen($u) > 2000) {
            return null;
        }
        $t = strtolower((string) $type);

        return ['type' => in_array($t, ['image', 'video', 'audio'], true) ? $t : 'image', 'url' => $u];
    }

    private static function str(mixed $v): ?string
    {
        return is_string($v) && trim($v) !== '' ? mb_substr($v, 0, 4000) : null;
    }

    private static function unsupported(): ApiProblem
    {
        return ApiProblem::invalid('unsupported_deck', 'This flashcard set cannot be studied in this version of the app.');
    }
}

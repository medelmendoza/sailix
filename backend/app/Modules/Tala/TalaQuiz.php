<?php

namespace App\Modules\Tala;

use App\Support\ApiProblem;

/**
 * A Tala quiz ("up_quiz") parsed for SERVER-SIDE scoring (docs/13 §20, closes the D-T8 gap for quizzes).
 * Tala ships the answer key to whoever fetches the quiz; Sailix keeps it on the server: the app receives questions
 * only (publicView) and sends answers back; the score is computed here with Tala's own rules and is what gets written.
 * Rules mirror the Tala app (docs/reference/tala-analysis/02 §4.2) with its known defects fixed: checkbox answers are
 * compared as SETS of indices (not sorted characters). Anything this class does not fully understand is refused as
 * `unsupported_quiz` rather than scored on a guess.
 */
final class TalaQuiz
{
    private const MAX_QUESTIONS = 200;

    /**
     * @param  array<string, mixed>  $raw  Tala's quiz document
     * @param  list<array{source: array<string, mixed>, questions: list<array<string, mixed>>}>  $sections  internal sections; questions carry their answer key
     */
    private function __construct(
        public readonly string $id,
        public readonly string $name,
        public readonly ?string $description,
        public readonly float $passMark,
        private array $raw,
        private array $sections,
    ) {}

    /** @param array<string, mixed> $raw Tala's quiz document */
    public static function parse(array $raw): self
    {
        $id = is_string($raw['quizId'] ?? null) ? $raw['quizId'] : null;
        $pass = $raw['quizPercentage'] ?? null;
        if ($id === null || ! is_numeric($pass) || ! is_array($raw['arraySection'] ?? null) || $raw['arraySection'] === []) {
            throw self::unsupported();
        }

        $sections = [];
        $count = 0;
        foreach (array_values($raw['arraySection']) as $si => $section) {
            if (! is_array($section) || ! is_array($section['data'] ?? null)) {
                throw self::unsupported();
            }
            $questions = [];
            foreach (array_values($section['data']) as $qi => $q) {
                if (! is_array($q) || ++$count > self::MAX_QUESTIONS) {
                    throw self::unsupported();
                }
                $questions[] = self::question("$si.$qi", $q);
            }
            $sections[] = ['source' => $section, 'questions' => $questions];
        }

        return new self($id, (string) ($raw['quizName'] ?? ''), self::str($raw['quizDescription'] ?? null), (float) $pass, $raw, $sections);
    }

    /**
     * What the app may see: questions and choices, never answers; `version` detects a quiz that changed meanwhile.
     *
     * @return array<string, mixed>
     */
    public function publicView(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'version' => $this->version(),
            'sections' => array_map(fn (array $s, int $i) => [
                'id' => self::str($s['source']['sectionId'] ?? null) ?? (string) $i,
                'title' => self::str($s['source']['sectionTitle'] ?? null),
                'description' => self::str($s['source']['sectionDescription'] ?? null),
                'questions' => array_map(fn (array $q) => [
                    'ref' => $q['ref'],
                    'type' => $q['kind'],
                    'text' => $q['text'],
                    'choices' => $q['choices'],
                    'required' => $q['required'],
                    'media_type' => $q['mediaUrl'] !== null ? $q['mediaType'] : null,
                    'media_url' => $q['mediaUrl'],
                ], $s['questions']),
            ], $this->sections, array_keys($this->sections)),
        ];
    }

    public function version(): string
    {
        $fingerprint = array_map(fn (array $s) => array_map(fn (array $q) => [$q['ref'], $q['kind'], $q['text'], $q['choices']], $s['questions']), $this->sections);

        return substr(sha1((string) json_encode($fingerprint)), 0, 16);
    }

    /**
     * @param  list<mixed>  $answers
     * @return array{correct: int, wrong: int, total: int, average: float, passed: bool, byRef: array<string, array{user: string, correct: bool}>}
     */
    public function score(array $answers): array
    {
        $given = [];
        foreach ($answers as $a) {
            $ref = is_array($a) && is_string($a['ref'] ?? null) ? $a['ref'] : null;
            if ($ref === null || isset($given[$ref])) {
                throw ApiProblem::invalid('invalid_answers', 'Each question must be answered exactly once.');
            }
            $given[$ref] = $a['value'] ?? null;
        }

        $byRef = [];
        $correct = 0;
        $total = 0;
        foreach ($this->sections as $s) {
            foreach ($s['questions'] as $q) {
                $total++;
                if (! array_key_exists($q['ref'], $given)) {
                    throw ApiProblem::invalid('incomplete_answers', 'Please answer every question.');
                }
                [$ok, $display] = $this->mark($q, $given[$q['ref']]);
                $byRef[$q['ref']] = ['user' => $display, 'correct' => $ok];
                $correct += $ok ? 1 : 0;
            }
        }
        if (count($given) !== $total) {
            throw ApiProblem::invalid('invalid_answers', 'Unknown question in the answers.');
        }
        $average = round($correct / $total * 100, 2);

        return ['correct' => $correct, 'wrong' => $total - $correct, 'total' => $total, 'average' => $average, 'passed' => $average >= $this->passMark, 'byRef' => $byRef];
    }

    /**
     * The quiz row for Tala's sync payload, in the shape the Tala app itself posts.
     *
     * @param  array{correct: int, wrong: int, total: int, average: float, passed: bool, byRef: array<string, array{user: string, correct: bool}>}  $score
     * @return array<string, mixed>
     */
    public function syncRow(array $score): array
    {
        $sections = [];
        foreach ($this->sections as $s) {
            $src = $s['source'];
            $sections[] = [
                'sectionId' => self::str($src['sectionId'] ?? null) ?? '',
                'sectionTitle' => self::str($src['sectionTitle'] ?? null) ?? '',
                'sectionDescription' => self::str($src['sectionDescription'] ?? null) ?? '',
                'sectionMediaType' => self::str($src['sectionMediaType'] ?? null) ?? '',
                'sectionMedia' => self::str($src['sectionMedia'] ?? null) ?? '',
                'pagePerSection' => self::str($src['pagePerSection'] ?? null) ?? '',
                'data' => array_map(fn (array $q) => [
                    'tags' => self::str($q['source']['tags'] ?? null) ?? '',
                    'numQuestion' => self::str($q['source']['numQuestion'] ?? null) ?? '',
                    'questionType' => self::str($q['source']['questionType'] ?? null) ?? '',
                    'question' => $q['text'],
                    'answer' => self::str($q['source']['answer'] ?? null) ?? '',
                    'choices' => self::str($q['source']['choices'] ?? null) ?? '',
                    'mediaType' => self::str($q['source']['mediaType'] ?? null) ?? '',
                    'mediaUploaded' => self::str($q['source']['mediaUploaded'] ?? null) ?? '',
                    'required' => self::str($q['source']['required'] ?? null) ?? '',
                    'userAnswer' => $score['byRef'][$q['ref']]['user'],
                    'result' => $score['byRef'][$q['ref']]['correct'] ? 'CORRECT' : 'WRONG',
                ], $s['questions']),
            ];
        }

        return [
            'quizId' => $this->id,
            'quizName' => $this->name,
            'quizDescription' => $this->description ?? '',
            'quizThumbnailUrl' => self::str($this->raw['quizThumbnailUrl'] ?? null) ?? '',
            'status' => 'COMPLETED',
            'quizPercentage' => (string) $this->raw['quizPercentage'],
            'correct' => $score['correct'],
            'wrong' => $score['wrong'],
            'average' => $score['average'],
            'remarks' => $score['passed'] ? 'PASSED' : 'FAILED',
            'progress' => '',
            'tags' => self::str($this->raw['tags'] ?? null) ?? '',
            'sections' => $sections,
        ];
    }

    /**
     * @param  array<string, mixed>  $q
     * @return array{ref: string, kind: string, text: string, choices: list<string>, required: bool, mediaType: string|null, mediaUrl: string|null, answerKey: mixed, source: array<string, mixed>}
     */
    private static function question(string $ref, array $q): array
    {
        $type = (string) ($q['questionType'] ?? '');
        $kind = match ($type) {
            'multipleChoice' => 'single',
            'checkbox' => 'multiple',
            default => 'text', // as the Tala app: any other type is a typed answer
        };
        $text = self::str($q['question'] ?? null);
        $answer = self::str($q['answer'] ?? null);
        if ($text === null || $answer === null) {
            throw self::unsupported();
        }

        $choices = [];
        $key = null;
        if ($kind !== 'text') {
            $choices = explode(':', (string) ($q['choices'] ?? ''));
            $n = count($choices);
            if ($n < 2 || $n > 12 || in_array('', $choices, true)) {
                throw self::unsupported();
            }
            $indices = explode(':', $answer);
            foreach ($indices as $i) {
                // Indices are 0-based in every quiz observed (T0c); anything else is not scored on a guess.
                if (preg_match('/^\d{1,2}$/', $i) !== 1 || (int) $i >= $n) {
                    throw self::unsupported();
                }
            }
            $set = array_values(array_unique(array_map('intval', $indices)));
            sort($set);
            if ($kind === 'single' && count($set) !== 1) {
                throw self::unsupported();
            }
            $key = $set;
        } else {
            $key = self::normalize($answer);
        }

        $media = self::str($q['mediaUploaded'] ?? null);

        return [
            'ref' => $ref, 'kind' => $kind, 'text' => $text, 'choices' => $choices, 'required' => filter_var($q['required'] ?? false, FILTER_VALIDATE_BOOLEAN),
            'mediaType' => self::str($q['mediaType'] ?? null),
            'mediaUrl' => $media !== null && str_starts_with(strtolower($media), 'https://') && filter_var($media, FILTER_VALIDATE_URL) !== false ? $media : null,
            'answerKey' => $key, 'source' => $q,
        ];
    }

    /**
     * @param  array<string, mixed>  $q
     * @return array{0: bool, 1: string} correct?, the text stored as the user's answer (as the Tala app stores it)
     */
    private function mark(array $q, mixed $value): array
    {
        if ($q['kind'] === 'single') {
            $i = $this->index($value, count($q['choices']));

            return [[$i] === $q['answerKey'], $q['choices'][$i]];
        }
        if ($q['kind'] === 'multiple') {
            if (! is_array($value) || $value === [] || count($value) > count($q['choices'])) {
                throw ApiProblem::invalid('invalid_answers', 'Choose at least one option.');
            }
            $set = array_values(array_unique(array_map(fn ($v) => $this->index($v, count($q['choices'])), $value)));
            sort($set);

            return [$set === $q['answerKey'], '['.implode(', ', array_map(fn (int $i) => $q['choices'][$i], $set)).']'];
        }
        if (! is_string($value) || trim($value) === '' || mb_strlen($value) > 1000) {
            throw ApiProblem::invalid('invalid_answers', 'Enter an answer.');
        }

        return [self::normalize($value) === $q['answerKey'], trim($value)];
    }

    private function index(mixed $v, int $n): int
    {
        if ((! is_string($v) && ! is_int($v)) || preg_match('/^\d{1,2}$/', (string) $v) !== 1 || (int) $v >= $n) {
            throw ApiProblem::invalid('invalid_answers', 'That option does not exist.');
        }

        return (int) $v;
    }

    /** Tala's comparison: trimmed, all whitespace removed, upper-cased. */
    private static function normalize(string $s): string
    {
        return mb_strtoupper((string) preg_replace('/\s+/u', '', trim($s)));
    }

    private static function str(mixed $v): ?string
    {
        return is_string($v) && $v !== '' ? $v : (is_int($v) || is_float($v) ? (string) $v : null);
    }

    private static function unsupported(): ApiProblem
    {
        return ApiProblem::invalid('unsupported_quiz', 'This quiz cannot be taken in this version of the app.');
    }
}

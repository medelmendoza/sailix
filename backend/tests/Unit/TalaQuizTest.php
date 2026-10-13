<?php

namespace Tests\Unit;

use App\Modules\Tala\TalaQuiz;
use App\Support\ApiProblem;
use PHPUnit\Framework\TestCase;

/** Server-side quiz scoring (the answer key never leaves the server). Pure unit tests: no framework, no network. */
class TalaQuizTest extends TestCase
{
    /** @param list<array<string, mixed>> $questions */
    private function raw(?array $questions = null, array $over = []): array
    {
        $questions ??= [
            ['questionType' => 'multipleChoice', 'numQuestion' => '1', 'question' => 'Pick one?', 'answer' => '2', 'choices' => 'red:green:blue:black', 'required' => 'true', 'mediaType' => '', 'mediaUploaded' => '', 'tags' => ''],
            ['questionType' => 'checkbox', 'numQuestion' => '2', 'question' => 'Pick all?', 'answer' => '0:2', 'choices' => 'a:b:c:d', 'required' => 'true'],
            ['questionType' => 'identification', 'numQuestion' => '3', 'question' => 'Name it', 'answer' => 'Life Jacket', 'required' => 'false'],
        ];

        return $over + [
            'quizId' => 'q1', 'quizName' => 'Final', 'quizDescription' => 'desc', 'quizPercentage' => '70', 'tags' => 't', 'quizThumbnailUrl' => 'https://cdn.example.com/q.png',
            'arraySection' => [['sectionId' => 's1', 'sectionTitle' => 'Part 1', 'sectionDescription' => '', 'sectionMediaType' => '', 'sectionMedia' => '', 'pagePerSection' => '1', 'data' => $questions]],
        ];
    }

    private function answers(array $values): array
    {
        $out = [];
        foreach ($values as $i => $v) {
            $out[] = ['ref' => "0.$i", 'value' => $v];
        }

        return $out;
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

    public function test_the_public_view_contains_questions_and_choices_but_never_an_answer(): void
    {
        $view = TalaQuiz::parse($this->raw())->publicView();
        $json = json_encode($view);

        $this->assertSame(['single', 'multiple', 'text'], array_column($view['sections'][0]['questions'], 'type'));
        $this->assertSame(['red', 'green', 'blue', 'black'], $view['sections'][0]['questions'][0]['choices']);
        $this->assertStringNotContainsString('Life Jacket', $json);
        $this->assertStringNotContainsString('answer', strtolower($json));
        $this->assertSame(['ref', 'type', 'text', 'choices', 'required', 'media_type', 'media_url'], array_keys($view['sections'][0]['questions'][0]));
    }

    public function test_version_is_stable_and_changes_when_a_question_changes(): void
    {
        $a = TalaQuiz::parse($this->raw())->version();
        $this->assertSame($a, TalaQuiz::parse($this->raw())->version());

        $q = $this->raw()['arraySection'][0]['data'];
        $q[0]['question'] = 'Pick another?';
        $this->assertNotSame($a, TalaQuiz::parse($this->raw($q))->version());
    }

    public function test_it_scores_with_tala_rules(): void
    {
        $quiz = TalaQuiz::parse($this->raw());

        $all = $quiz->score($this->answers(['2', ['2', '0'], '  life   JACKET ']));
        $this->assertSame([3, 0, 3, 100.0, true], [$all['correct'], $all['wrong'], $all['total'], $all['average'], $all['passed']]);

        $mixed = $quiz->score($this->answers(['1', ['0', '2'], 'Life Jacket']));
        $this->assertSame([2, 1, 66.67, false], [$mixed['correct'], $mixed['wrong'], $mixed['average'], $mixed['passed']]); // 66.67 < 70
        $this->assertSame(['0.0' => false, '0.1' => true, '0.2' => true], array_map(fn ($r) => $r['correct'], $mixed['byRef']));
    }

    public function test_checkbox_is_compared_as_a_set_not_as_sorted_characters(): void
    {
        $raw = $this->raw([['questionType' => 'checkbox', 'question' => 'x', 'answer' => '1:10', 'choices' => implode(':', range('a', 'l'))]]);
        $quiz = TalaQuiz::parse($raw);

        $this->assertTrue($quiz->score($this->answers([['10', '1']]))['byRef']['0.0']['correct']);          // order does not matter
        $this->assertTrue($quiz->score($this->answers([['1', '10', '1']]))['byRef']['0.0']['correct']);     // duplicates collapse
        $this->assertFalse($quiz->score($this->answers([['11', '0']]))['byRef']['0.0']['correct']);         // the Flutter app's "1:10" == "11:0" defect
        $this->assertFalse($quiz->score($this->answers([['1']]))['byRef']['0.0']['correct']);               // subset
        $this->assertFalse($quiz->score($this->answers([['1', '10', '2']]))['byRef']['0.0']['correct']);    // superset
    }

    public function test_stored_user_answers_follow_the_tala_app_format(): void
    {
        $quiz = TalaQuiz::parse($this->raw());
        $row = $quiz->syncRow($quiz->score($this->answers(['2', ['2', '0'], ' Life Jacket '])));

        $data = $row['sections'][0]['data'];
        $this->assertSame(['blue', '[a, c]', 'Life Jacket'], array_column($data, 'userAnswer'));
        $this->assertSame(['CORRECT', 'CORRECT', 'CORRECT'], array_column($data, 'result'));
        $this->assertSame('COMPLETED', $row['status']);
        $this->assertSame('PASSED', $row['remarks']);
        $this->assertSame(3, $row['correct']);
        $this->assertSame(0, $row['wrong']);
        $this->assertSame(100.0, $row['average']);
        $this->assertSame('70', $row['quizPercentage']);
        $this->assertSame('2', $data[0]['answer']);                     // Tala's own row keeps Tala's own key (server-side only)
        $this->assertSame('red:green:blue:black', $data[0]['choices']);
    }

    public function test_incomplete_duplicate_unknown_and_malformed_answers_are_refused(): void
    {
        $quiz = TalaQuiz::parse($this->raw());

        $this->assertSame('incomplete_answers', $this->code(fn () => $quiz->score($this->answers(['2', ['0']]))));
        $this->assertSame('invalid_answers', $this->code(fn () => $quiz->score([['ref' => '0.0', 'value' => '2'], ['ref' => '0.0', 'value' => '1'], ['ref' => '0.1', 'value' => ['0']], ['ref' => '0.2', 'value' => 'x']])));
        $this->assertSame('invalid_answers', $this->code(fn () => $quiz->score([...$this->answers(['2', ['0'], 'x']), ['ref' => '9.9', 'value' => '1']])));
        $this->assertSame('invalid_answers', $this->code(fn () => $quiz->score($this->answers(['4', ['0'], 'x']))));        // no such option
        $this->assertSame('invalid_answers', $this->code(fn () => $quiz->score($this->answers(['-1', ['0'], 'x']))));
        $this->assertSame('invalid_answers', $this->code(fn () => $quiz->score($this->answers([['2'], ['0'], 'x']))));     // list for a single choice
        $this->assertSame('invalid_answers', $this->code(fn () => $quiz->score($this->answers(['2', [], 'x']))));          // empty checkbox
        $this->assertSame('invalid_answers', $this->code(fn () => $quiz->score($this->answers(['2', ['0'], '   ']))));     // blank text
        $this->assertSame('invalid_answers', $this->code(fn () => $quiz->score($this->answers(['2', ['0'], str_repeat('x', 1001)]))));
        $this->assertSame('invalid_answers', $this->code(fn () => $quiz->score(['nonsense', 5])));
    }

    public function test_formats_that_cannot_be_scored_with_certainty_are_refused_not_guessed(): void
    {
        $base = $this->raw()['arraySection'][0]['data'][0];
        $cases = [
            'answer outside the options (1-based quiz)' => [['answer' => '4']],
            'answer not a number' => [['answer' => 'b']],
            'single choice with two answers' => [['answer' => '1:2']],
            'one choice only' => [['choices' => 'only']],
            'empty choice' => [['choices' => 'a::c:d']],
            'too many choices' => [['choices' => implode(':', range(1, 13))]],
            'missing answer' => [['answer' => '']],
            'missing question' => [['question' => '']],
        ];
        foreach ($cases as $name => [$patch]) {
            $this->assertSame('unsupported_quiz', $this->code(fn () => TalaQuiz::parse($this->raw([array_replace($base, $patch)]))), $name);
        }
        $this->assertSame('unsupported_quiz', $this->code(fn () => TalaQuiz::parse($this->raw(null, ['quizPercentage' => 'n/a']))));
        $this->assertSame('unsupported_quiz', $this->code(fn () => TalaQuiz::parse($this->raw(null, ['arraySection' => []]))));
        $this->assertSame('unsupported_quiz', $this->code(fn () => TalaQuiz::parse(['quizId' => 'q'])));
        $this->assertSame('unsupported_quiz', $this->code(fn () => TalaQuiz::parse($this->raw(array_fill(0, 201, $base)))));
    }

    public function test_media_addresses_are_passed_on_only_when_https(): void
    {
        $q = $this->raw()['arraySection'][0]['data'][0];
        $view = TalaQuiz::parse($this->raw([$q + ['mediaType' => 'image'], array_replace($q, ['mediaType' => 'image', 'mediaUploaded' => 'https://cdn.example.com/a.png']), array_replace($q, ['mediaType' => 'image', 'mediaUploaded' => 'javascript:alert(1)'])]))->publicView();

        $media = array_column($view['sections'][0]['questions'], 'media_url');
        $this->assertSame([null, 'https://cdn.example.com/a.png', null], $media);
    }
}

<?php

namespace App\Modules\Tala;

use App\Enums\LinkStatus;
use App\Identity\ExternalAccountLinker;
use App\Models\ExternalIdentity;
use App\Models\Membership;
use App\Models\ModuleLink;
use App\Models\TenantModule;
use App\Models\User;
use App\Modules\Module;
use App\Support\ApiProblem;
use App\Support\Audit;
use Closure;
use Illuminate\Support\Facades\Cache;

/**
 * Read-only Tala gateway for the authenticated membership (ADR-0018). Every Tala call is made with the user id
 * and team id stored on the membership's link; nothing the client sends is ever used as an upstream identifier
 * (the only client-chosen ids, assignment/material, are looked up in Tala's own answer for THIS user).
 */
final class TalaGateway
{
    /** Material kinds shown in the MVP. EPUB and legacy quizzes are excluded (D-T6); quizzes are listed, never delivered (D-T8). */
    private const TYPES = ['video' => 'video', 'pdf' => 'pdf', 'up_quiz' => 'quiz', 'up_card' => 'flashcards'];

    public function __construct(
        private TalaClient $client,
        private ExternalAccountLinker $identities,
    ) {}

    /** @return array{status: string, linked_at: string|null, last_verified_at: string|null} */
    public function status(Membership $membership): array
    {
        $link = $this->currentLink($membership);

        return [
            'status' => $link?->status->value ?? 'not_linked',
            'linked_at' => $link?->linked_at?->toIso8601String(),
            'last_verified_at' => $link?->last_verified_at?->toIso8601String(),
        ];
    }

    /** @return array{status: string, linked_at: string|null, last_verified_at: string|null} */
    public function linkAccount(User $user, Membership $membership, string $username, string $password): array
    {
        $team = TenantModule::where('module', Module::Tala->value)->value('external_team_id');
        if (! is_string($team) || $team === '') {
            throw ApiProblem::forbidden('module_disabled', 'This module is not available for your organization.');
        }

        try {
            $login = $this->client->login($username, $password);
            $teams = $this->client->teamIds($login['access_token'], $login['user_id']);
        } catch (TalaLoginRejected|TalaUnauthorized) {
            throw ApiProblem::invalid('link_failed', 'Tala did not accept those credentials.');
        } catch (TalaUnavailable) {
            throw $this->unavailable();
        }
        if (! in_array($team, $teams, true)) {
            throw ApiProblem::invalid('team_not_in_organization', "This Tala account does not belong to your organization's team.");
        }

        $identity = $this->identities->claim($user, Module::Tala, $login['user_id']);
        $link = ModuleLink::where('membership_id', $membership->getKey())->where('module', Module::Tala->value)->first() ?? new ModuleLink;
        $link->forceFill([
            'tenant_id' => $membership->tenant_id,
            'membership_id' => $membership->getKey(),
            'module' => Module::Tala->value,
            'external_identity_id' => $identity->getKey(),
            'external_team_id' => $team,
            'status' => LinkStatus::Linked,
            'access_token' => $login['access_token'],
            'refresh_token' => $login['refresh_token'],
            'token_expires_at' => TalaJwt::expiry($login['access_token']),
            'linked_at' => now(),
            'last_verified_at' => now(),
        ])->save();
        Audit::record('module.tala.linked', $membership->tenant_id, $link, [], $user);

        return $this->status($membership);
    }

    public function unlink(User $user, Membership $membership): void
    {
        $link = $this->currentLink($membership);
        if ($link === null) {
            return;
        }
        $this->identities->release($link);
        Audit::record('module.tala.unlinked', $membership->tenant_id, $membership, [], $user);
    }

    /** @return list<array<string, mixed>> */
    public function courses(Membership $membership): array
    {
        return $this->authorized($membership, function (ModuleLink $link, string $token, string $tala) {
            return array_map(fn (array $a) => $this->course($a), $this->assignments($token, $tala, $link));
        });
    }

    /**
     * Applies to join a course by code. A write to Tala (flag-gated like the other writes). The code is never logged or
     * audited, and Tala's answer to a wrong code is reduced to one message so codes cannot be probed for detail.
     *
     * @return array{status: string}
     */
    public function joinCourse(Membership $membership, string $code): array
    {
        if (! $this->progressWritesEnabled()) {
            throw ApiProblem::forbidden('feature_disabled', 'Joining a course is not enabled.');
        }

        $result = $this->authorized($membership, function (ModuleLink $link, string $token, string $tala) use ($code) {
            try {
                $this->client->applyToCourse($token, $tala, $link->external_team_id, $code);
            } catch (TalaCourseCodeRejected) {
                return false;
            }

            return true;
        });
        if (! $result) {
            throw ApiProblem::invalid('course_code_rejected', 'That course code was not accepted.');
        }
        Audit::record('module.tala.course_join_requested', $membership->tenant_id, null);

        return ['status' => 'requested'];
    }

    /** @return array<string, mixed> */
    public function courseDetail(Membership $membership, string $assignId): array
    {
        return $this->authorized($membership, function (ModuleLink $link, string $token, string $tala) use ($assignId) {
            $assignment = $this->findAssignment($this->assignments($token, $tala, $link), $assignId);
            $course = $this->course($assignment);
            [$visible, $hidden] = $this->materials($assignment);

            $stored = [];
            try {
                $stored = $this->client->progress($token, $tala, $link->external_team_id, (string) ($assignment['courseId'] ?? ''), $assignId);
            } catch (TalaUnavailable) {
                // progress is a nice-to-have: show the course without it rather than failing the screen
            }
            $progress = $this->progressById($stored);

            return $course + [
                'materials' => array_map(fn (array $m) => $m + [
                    'progress' => $progress[$m['id']]['progress'] ?? null,
                    'status' => $progress[$m['id']]['status'] ?? null,
                    'stats' => $progress[$m['id']]['stats'] ?? null,
                ], $visible),
                'hidden_materials' => $hidden,
                'progress_submission' => $this->progressWritesEnabled(),
            ];
        });
    }

    /**
     * Marks the caller's own video/PDF materials as completed in Tala (write; flag-gated, docs/13 §20).
     * The payload sent to Tala is built SERVER-SIDE from Tala's own stored snapshot of this user: the client only names
     * material ids. No score, comment, name or any other client value is forwarded; completion never goes backwards.
     *
     * Video feedback (star rating + comment, as in the Tala app) may accompany the video ids it belongs to.
     *
     * @param  list<string>  $materialIds
     * @param  array<string, mixed>  $feedback  by video id: ['rating' => 1..5 in half steps, 'comment' => text|null]
     * @return array<string, mixed>
     */
    public function submitProgress(Membership $membership, string $assignId, array $materialIds, array $feedback = []): array
    {
        $materialIds = array_values(array_unique($materialIds));

        $result = $this->writeSnapshot($membership, $assignId, function (array $visible) use ($materialIds, $feedback) {
            foreach ($materialIds as $id) {
                $summary = $visible[$id] ?? throw ApiProblem::notFound('Material not found.');
                if (! in_array($summary['type'], ['video', 'pdf'], true)) {
                    throw ApiProblem::invalid('unsupported_material', 'Quizzes and flashcards have their own screens.');
                }
            }
            foreach ($feedback as $id => $f) {
                $rating = is_array($f) ? ($f['rating'] ?? null) : null; // untrusted shape: checked below
                if (! in_array($id, $materialIds, true) || ($visible[$id]['type'] ?? null) !== 'video' || ! is_numeric($rating) || (float) $rating < 1 || (float) $rating > 5 || fmod((float) $rating * 2, 1.0) !== 0.0) {
                    throw ApiProblem::invalid('invalid_feedback', 'Feedback belongs to a video you are completing and needs a rating from 1 to 5.');
                }
            }

            return function (array &$item, ModuleLink $link, string $token) use ($materialIds, $visible, $feedback) {
                foreach ($materialIds as $id) {
                    $kind = $visible[$id]['type'] === 'video' ? 'videos' : 'pdfs';
                    $idKey = $kind === 'videos' ? 'videoId' : 'pdfId';
                    $index = null;
                    foreach ($item['materials'][$kind] as $i => $row) {
                        if (($row[$idKey] ?? null) === $id) {
                            $item['materials'][$kind][$i]['status'] = 'COMPLETED';
                            $index = $i;
                        }
                    }
                    if ($index === null) {
                        $item['materials'][$kind][] = $this->newMaterialRow($token, $link, $kind, $id);
                        $index = array_key_last($item['materials'][$kind]);
                    }
                    if (isset($feedback[$id])) {
                        $item['materials'][$kind][$index]['feedback'] = (float) $feedback[$id]['rating'];
                        $item['materials'][$kind][$index]['comment'] = $this->cleanComment($feedback[$id]['comment'] ?? null);
                    }
                }
            };
        });

        return $result + ['completed' => $materialIds];
    }

    /**
     * Shared read-modify-write of Tala's per-user course snapshot. Tala REPLACES the whole set of rows with what it is
     * sent and stores progress exactly as sent (verified 2026-10-13, docs/13 §20), so every existing row is carried over
     * and the course counters are recomputed here. Locked per link; never retried.
     *
     * @param  Closure  $prepare  receives the visible materials keyed by id, validates the request, and returns the mutation of the sync item
     * @return array{progress: string, status: string}
     */
    private function writeSnapshot(Membership $membership, string $assignId, Closure $prepare): array
    {
        if (! $this->progressWritesEnabled()) {
            throw ApiProblem::forbidden('feature_disabled', 'Submitting progress is not enabled.');
        }

        return $this->authorized($membership, function (ModuleLink $link, string $token, string $tala) use ($assignId, $prepare, $membership) {
            $assignment = $this->findAssignment($this->assignments($token, $tala, $link), $assignId);
            $visible = collect($this->materials($assignment)[0])->keyBy('id')->all();
            $mutate = $prepare($visible);

            $lock = Cache::lock('tala-progress:'.$link->getKey(), 30);
            if (! $lock->get()) {
                throw ApiProblem::conflict('progress_busy', 'Another update is in progress. Try again.');
            }
            try {
                $courseId = (string) ($assignment['courseId'] ?? '');
                $snapshot = $this->client->progress($token, $tala, $link->external_team_id, $courseId, $assignId);
                $item = $this->syncItem($snapshot, $assignment);

                $mutate($item, $link, $token);

                $total = (int) ($assignment['course']['totalMaterial'] ?? 0) ?: count($visible);
                $done = 0;
                foreach ($item['materials'] as $group) {
                    foreach ($group as $row) {
                        $done += (($row['status'] ?? null) === 'COMPLETED') ? 1 : 0;
                    }
                }
                $before = (int) explode('/', (string) ($snapshot['progress'] ?? '0/0'))[0];
                $done = max($done, $before); // completion never goes backwards
                $item['progress'] = $done.'/'.$total;
                $item['status'] = $done >= $total ? 'COMPLETED' : 'NOT YET COMPLETED';

                $this->client->submitSync($token, $tala, $link->external_team_id, $item);
                Audit::record('module.tala.progress_submitted', $membership->tenant_id, $link, ['materials' => 1]);

                return ['progress' => $item['progress'], 'status' => $item['status']];
            } finally {
                $lock->release();
            }
        });
    }

    /**
     * The questions of one quiz of the caller's own course. Never contains an answer or the answer key.
     *
     * @return array<string, mixed>
     */
    public function quiz(Membership $membership, string $assignId, string $quizId): array
    {
        if (! $this->progressWritesEnabled()) {
            throw ApiProblem::forbidden('feature_disabled', 'Quizzes are not enabled.');
        }

        return $this->authorized($membership, function (ModuleLink $link, string $token, string $tala) use ($assignId, $quizId) {
            $assignment = $this->findAssignment($this->assignments($token, $tala, $link), $assignId);
            $this->assertQuiz($assignment, $quizId);

            return TalaQuiz::parse($this->client->quiz($token, $link->external_team_id, $quizId))->publicView();
        });
    }

    /**
     * Scores the answers HERE with the answer key Tala holds, then records the result in Tala (write, flag-gated).
     * The client never supplies a score, a result or a status; it receives totals only (no per-question answers).
     *
     * @param  list<mixed>  $answers
     * @return array<string, mixed>
     */
    public function submitQuiz(Membership $membership, string $assignId, string $quizId, ?string $version, array $answers): array
    {
        $scored = null;
        $progress = $this->writeSnapshot($membership, $assignId, function (array $visible) use ($quizId, $version, $answers, &$scored) {
            if (($visible[$quizId]['type'] ?? null) !== 'quiz') {
                throw ApiProblem::notFound('Quiz not found.');
            }

            return function (array &$item, ModuleLink $link, string $token) use ($quizId, $version, $answers, &$scored) {
                $quiz = TalaQuiz::parse($this->client->quiz($token, $link->external_team_id, $quizId));
                if ($version !== null && $version !== $quiz->version()) {
                    throw ApiProblem::conflict('quiz_changed', 'This quiz was updated. Reload it and try again.');
                }
                $scored = $quiz->score($answers);
                $row = $quiz->syncRow($scored);

                $replaced = false;
                foreach ($item['materials']['quizzes'] as $i => $existing) {
                    if (($existing['quizId'] ?? null) === $quizId) {
                        $item['materials']['quizzes'][$i] = $row; // a retake replaces the stored attempt, as in the Tala app
                        $replaced = true;
                    }
                }
                if (! $replaced) {
                    $item['materials']['quizzes'][] = $row;
                }
            };
        });
        Audit::record('module.tala.quiz_submitted', $membership->tenant_id, null, ['passed' => $scored['passed'] ?? null]);

        return $progress + [
            'correct' => $scored['correct'] ?? 0,
            'wrong' => $scored['wrong'] ?? 0,
            'total' => $scored['total'] ?? 0,
            'average' => $scored['average'] ?? 0.0,
            'passed' => $scored['passed'] ?? false,
        ];
    }

    /**
     * The cards of one flashcard set of the caller's own course, with any ratings Tala already holds for them.
     *
     * @return array<string, mixed>
     */
    public function flashcards(Membership $membership, string $assignId, string $cardId): array
    {
        if (! $this->progressWritesEnabled()) {
            throw ApiProblem::forbidden('feature_disabled', 'Flashcards are not enabled.');
        }

        return $this->authorized($membership, function (ModuleLink $link, string $token, string $tala) use ($assignId, $cardId) {
            $assignment = $this->findAssignment($this->assignments($token, $tala, $link), $assignId);
            $this->assertMaterial($assignment, $cardId, 'flashcards');
            $deck = TalaDeck::parse($this->client->deck($token, $link->external_team_id, $cardId));

            $stored = null;
            try {
                $snapshot = $this->client->progress($token, $tala, $link->external_team_id, (string) ($assignment['courseId'] ?? ''), $assignId);
                foreach (is_array($snapshot['materials']['cards'] ?? null) ? $snapshot['materials']['cards'] : [] as $row) {
                    if (is_array($row) && ($row['cardId'] ?? null) === $cardId) {
                        $stored = $row;
                    }
                }
            } catch (TalaUnavailable) {
                // resuming earlier ratings is a nicety: study works without it
            }

            return $deck->publicView($stored);
        });
    }

    /**
     * Records a COMPLETE set of ratings (every card rated) for a flashcard set, as the Tala app does: only when the
     * set is finished. The row Tala stores is built here from Tala's own deck, never from client text.
     *
     * @param  list<mixed>  $ratings
     * @return array<string, mixed>
     */
    public function submitFlashcards(Membership $membership, string $assignId, string $cardId, ?string $version, array $ratings): array
    {
        $summary = null;
        $progress = $this->writeSnapshot($membership, $assignId, function (array $visible) use ($cardId, $version, $ratings, &$summary) {
            if (($visible[$cardId]['type'] ?? null) !== 'flashcards') {
                throw ApiProblem::notFound('Flashcard set not found.');
            }

            return function (array &$item, ModuleLink $link, string $token) use ($cardId, $version, $ratings, &$summary) {
                $deck = TalaDeck::parse($this->client->deck($token, $link->external_team_id, $cardId));
                if ($version !== null && $version !== $deck->version()) {
                    throw ApiProblem::conflict('deck_changed', 'This flashcard set was updated. Reload it and rate again.');
                }
                $valid = $deck->validateRatings($ratings);
                $row = $deck->syncRow($valid);
                $summary = array_count_values($valid);

                $replaced = false;
                foreach ($item['materials']['cards'] as $i => $existing) {
                    if (($existing['cardId'] ?? null) === $cardId) {
                        $item['materials']['cards'][$i] = $row;
                        $replaced = true;
                    }
                }
                if (! $replaced) {
                    $item['materials']['cards'][] = $row;
                }
            };
        });

        return $progress + ['easy' => $summary['easy'] ?? 0, 'medium' => $summary['medium'] ?? 0, 'hard' => $summary['hard'] ?? 0];
    }

    /** @param array<string, mixed> $assignment */
    private function assertMaterial(array $assignment, string $id, string $type): void
    {
        $summary = collect($this->materials($assignment)[0])->firstWhere('id', $id);
        if ($summary === null || $summary['type'] !== $type) {
            throw ApiProblem::notFound('Material not found.');
        }
    }

    /** Free text typed by the user, stored in Tala: plain text only, bounded, "N/A" when empty (as the Tala app does). */
    private function cleanComment(mixed $comment): string
    {
        $text = is_string($comment) ? trim((string) preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $comment)) : '';

        return $text === '' ? 'N/A' : mb_substr($text, 0, 1000);
    }

    /** @param array<string, mixed> $assignment */
    private function assertQuiz(array $assignment, string $quizId): void
    {
        $summary = collect($this->materials($assignment)[0])->firstWhere('id', $quizId);
        if ($summary === null || $summary['type'] !== 'quiz') {
            throw ApiProblem::notFound('Quiz not found.');
        }
    }

    /** @return array<string, mixed> */
    public function material(Membership $membership, string $assignId, string $materialId): array
    {
        return $this->authorized($membership, function (ModuleLink $link, string $token, string $tala) use ($assignId, $materialId) {
            $assignment = $this->findAssignment($this->assignments($token, $tala, $link), $assignId);
            $summary = collect($this->materials($assignment)[0])->firstWhere('id', $materialId)
                ?? throw ApiProblem::notFound('Material not found.');
            if (in_array($summary['type'], ['quiz', 'flashcards'], true)) {
                throw ApiProblem::invalid('unsupported_material', 'This item has no file to open.');
            }
            $kind = $summary['type'] === 'video' ? 'videos' : 'pdf';
            $raw = $this->client->material($token, $link->external_team_id, $kind, $materialId);
            $prefix = $summary['type'] === 'video' ? 'video' : 'pdf';

            return [
                'id' => $materialId,
                'type' => $summary['type'],
                'name' => $this->str($raw["{$prefix}Name"] ?? null) ?? $summary['name'],
                'description' => $this->str($raw["{$prefix}Description"] ?? null),
                'thumbnail_url' => $this->https($raw["{$prefix}ThumbnailUrl"] ?? null),
                'file_url' => $this->https($raw["{$prefix}FileUrl"] ?? null),
            ];
        });
    }

    private function progressWritesEnabled(): bool
    {
        return (bool) config('sailix.modules.tala.progress_writes');
    }

    /**
     * Course-level sync item from Tala's own stored snapshot, restricted to the fields the Tala app itself posts.
     *
     * @param  array<string, mixed>  $snapshot
     * @param  array<string, mixed>  $assignment
     * @return array<string, mixed>
     */
    private function syncItem(array $snapshot, array $assignment): array
    {
        $keep = ['assignId', 'courseId', 'courseName', 'courseDescription', 'userId', 'teamId', 'lastName', 'firstName', 'middleName',
            'dateFrom', 'dateTo', 'dateAssigned', 'assignedBy', 'email', 'status', 'progress', 'syncDate', 'courseTags', 'userTags'];
        $item = array_intersect_key($snapshot !== [] ? $snapshot : $assignment, array_flip($keep));
        if ($snapshot === []) {
            // Never synced: Tala holds no snapshot yet, so the course-level record is built from the assignment itself
            // (the same fields the Tala app posts), with zero progress.
            $course = is_array($assignment['course'] ?? null) ? $assignment['course'] : [];
            $item['courseName'] = $this->str($course['courseName'] ?? null) ?? '';
            $item['courseDescription'] = $this->str($course['courseDescription'] ?? null) ?? '';
            $item['courseTags'] = $this->str($course['tags'] ?? null) ?? '';
            $item['userTags'] = $this->str($assignment['userTags'] ?? null) ?? '';
            $item['syncDate'] = '';
            $item['status'] = 'NOT YET COMPLETED';
            $item['progress'] = '0/'.((int) ($course['totalMaterial'] ?? 0));
        }
        $materials = is_array($snapshot['materials'] ?? null) ? $snapshot['materials'] : [];
        foreach (['videos', 'cards', 'quizzes', 'epubs', 'pdfs'] as $group) {
            $item['materials'][$group] = array_values(array_filter(is_array($materials[$group] ?? null) ? $materials[$group] : [], 'is_array'));
        }

        return $item;
    }

    /**
     * A material the user completed that Tala has no stored row for yet: built from Tala's own metadata.
     *
     * @return array<string, mixed>
     */
    private function newMaterialRow(string $token, ModuleLink $link, string $kind, string $id): array
    {
        $raw = $this->client->material($token, $link->external_team_id, $kind === 'videos' ? 'videos' : 'pdf', $id);
        $p = $kind === 'videos' ? 'video' : 'pdf';
        $row = [
            "{$p}Id" => $id,
            "{$p}Name" => $raw["{$p}Name"] ?? '',
            "{$p}Description" => $raw["{$p}Description"] ?? '',
            "{$p}FileUrl" => $raw["{$p}FileUrl"] ?? '',
            "{$p}FileName" => $raw["{$p}FileName"] ?? '',
            "{$p}ThumbnailUrl" => $raw["{$p}ThumbnailUrl"] ?? '',
            'status' => 'COMPLETED',
            'progress' => '',
            'tags' => $raw['tags'] ?? '',
        ];
        if ($kind === 'videos') {
            $row += ['feedback' => 0, 'comment' => ''];
        }

        return $row;
    }

    private function currentLink(Membership $membership): ?ModuleLink
    {
        return ModuleLink::where('membership_id', $membership->getKey())->where('module', Module::Tala->value)->first();
    }

    /**
     * Runs a Tala read with the link's own stored identity. Missing link, expired or rejected token → 409;
     * Tala unreachable → 503. A rejected token wipes the stored tokens and marks the link for relinking.
     *
     * @template T
     *
     * @param  Closure(ModuleLink, string, string): T  $call
     * @return T
     */
    private function authorized(Membership $membership, Closure $call): mixed
    {
        $link = $this->currentLink($membership);
        if ($link === null || $link->status === LinkStatus::Revoked) {
            throw ApiProblem::conflict('not_linked', 'Link your Tala account first.');
        }
        $token = $link->access_token;
        if ($link->status !== LinkStatus::Linked || ! is_string($token) || ($link->token_expires_at !== null && $link->token_expires_at->isPast())) {
            $this->needsRelink($link);
            throw ApiProblem::conflict('relink_required', 'Please link your Tala account again.');
        }
        $tala = ExternalIdentity::whereKey($link->external_identity_id)->value('external_user_id');
        if (! is_string($tala)) {
            throw ApiProblem::conflict('not_linked', 'Link your Tala account first.');
        }

        try {
            $result = $call($link, $token, $tala);
        } catch (TalaUnauthorized) {
            $this->needsRelink($link);
            throw ApiProblem::conflict('relink_required', 'Please link your Tala account again.');
        } catch (TalaUnavailable) {
            throw $this->unavailable();
        }
        $link->forceFill(['last_verified_at' => now()])->save();

        return $result;
    }

    private function needsRelink(ModuleLink $link): void
    {
        $link->forceFill(['status' => LinkStatus::NeedsRelink, 'access_token' => null, 'refresh_token' => null, 'token_expires_at' => null])->save();
        Audit::record('module.tala.relink_required', $link->tenant_id, $link);
    }

    private function unavailable(): ApiProblem
    {
        return new ApiProblem(503, 'module_unavailable', 'Tala is not reachable right now. Try again later.');
    }

    /** @return list<array<string, mixed>> */
    private function assignments(string $token, string $tala, ModuleLink $link): array
    {
        return array_values(array_filter($this->client->courses($token, $tala, $link->external_team_id), 'is_array'));
    }

    /**
     * @param  list<array<string, mixed>>  $assignments
     * @return array<string, mixed>
     */
    private function findAssignment(array $assignments, string $assignId): array
    {
        foreach ($assignments as $a) {
            if (($a['assignId'] ?? null) === $assignId) {
                return $a;
            }
        }
        throw ApiProblem::notFound('Course not found.');
    }

    /**
     * @param  array<string, mixed>  $a
     * @return array<string, mixed>
     */
    private function course(array $a): array
    {
        $course = is_array($a['course'] ?? null) ? $a['course'] : [];
        [$completed, $total] = $this->parseProgress($a['progress'] ?? null, (int) ($course['totalMaterial'] ?? 0));

        return [
            'id' => (string) ($a['assignId'] ?? ''),
            'name' => $this->str($course['courseName'] ?? null) ?? '',
            'description' => $this->str($course['courseDescription'] ?? null),
            'thumbnail_url' => $this->https($course['courseThumbnailUrl'] ?? null),
            'creator' => $this->str($course['courseCreator'] ?? null),
            'date_from' => $this->isoDate($a['dateFrom'] ?? null),
            'date_to' => $this->isoDate($a['dateTo'] ?? null),
            'status' => $this->str($a['status'] ?? null),
            'progress' => $this->str($a['progress'] ?? null),
            'completed' => $completed,
            'total' => $total,
            'percent' => $total > 0 ? (int) round(min($completed, $total) / $total * 100) : 0,
            'state' => strtoupper((string) ($a['status'] ?? '')) === 'COMPLETED' ? 'completed' : ($completed > 0 ? 'in_progress' : 'not_started'),
            'total_materials' => count($this->materials($a)[0]),
        ];
    }

    /**
     * Tala's own counter is "done/total" (null for a course never started). Counts every kind of material, including
     * those this app does not show, which is why it is exposed separately from `total_materials`.
     *
     * @return array{0: int, 1: int}
     */
    private function parseProgress(mixed $progress, int $fallbackTotal): array
    {
        if (is_string($progress) && preg_match('/^\s*(\d{1,5})\s*\/\s*(\d{1,5})\s*$/', $progress, $m) === 1) {
            return [(int) $m[1], (int) $m[2]];
        }

        return [0, max(0, $fallbackTotal)];
    }

    /** Dates in Tala's course list are `YYYY-MM-DD`; anything else is not guessed at. */
    private function isoDate(mixed $v): ?string
    {
        return is_string($v) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $v) === 1 && checkdate((int) substr($v, 5, 2), (int) substr($v, 8, 2), (int) substr($v, 0, 4)) ? $v : null;
    }

    /**
     * @param  array<string, mixed>  $assignment
     * @return array{0: list<array<string, mixed>>, 1: int} visible materials and the number left out
     */
    private function materials(array $assignment): array
    {
        $details = is_array($assignment['course']['materialDetails'] ?? null) ? $assignment['course']['materialDetails'] : [];
        $visible = [];
        $hidden = 0;
        foreach ($details as $d) {
            $type = is_array($d) ? (self::TYPES[strtolower((string) ($d['materialType'] ?? ''))] ?? null) : null;
            $id = is_array($d) ? $this->str($d['materialId'] ?? null) : null;
            if ($type === null || $id === null || preg_match('/^[A-Za-z0-9_-]{1,64}$/', $id) !== 1) {
                $hidden++;

                continue;
            }
            $visible[] = [
                'id' => $id,
                'type' => $type,
                'name' => $this->str($d['materialName'] ?? null) ?? '',
                'description' => $this->str($d['materialDescription'] ?? null),
                'thumbnail_url' => $this->https($d['materialThumbnailUrl'] ?? null),
                // quizzes (scored server-side) and flashcards (results are written back) need the write path
                'viewable' => ! in_array($type, ['quiz', 'flashcards'], true) || $this->progressWritesEnabled(),
            ];
        }

        return [$visible, $hidden];
    }

    /**
     * @param  array<string, mixed>  $stored
     * @return array<string, array{progress: string|null, status: string|null, stats: array<string, mixed>|null}>
     */
    private function progressById(array $stored): array
    {
        $out = [];
        $materials = is_array($stored['materials'] ?? null) ? $stored['materials'] : [];
        foreach (['videos' => 'videoId', 'pdfs' => 'pdfId', 'quizzes' => 'quizId', 'cards' => 'cardId'] as $group => $idKey) {
            foreach (is_array($materials[$group] ?? null) ? $materials[$group] : [] as $row) {
                if (is_array($row) && is_string($row[$idKey] ?? null)) {
                    $out[$row[$idKey]] = [
                        'progress' => $this->str($row['progress'] ?? null),
                        'status' => $this->str($row['status'] ?? null),
                        'stats' => $this->materialStats($group, $row),
                    ];
                }
            }
        }

        return $out;
    }

    /**
     * What the learner achieved on one material, from Tala's stored row (read-only; shown on My Stats).
     *
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>|null
     */
    private function materialStats(string $group, array $row): ?array
    {
        $int = fn (mixed $v): int => is_numeric($v) ? max(0, (int) $v) : 0;

        return match ($group) {
            'videos' => ['rating' => is_numeric($row['feedback'] ?? null) && (float) $row['feedback'] >= 1 ? (float) $row['feedback'] : null],
            'quizzes' => [
                'correct' => $int($row['correct'] ?? null),
                'wrong' => $int($row['wrong'] ?? null),
                'average' => is_numeric($row['average'] ?? null) ? round((float) $row['average'], 2) : null,
                'remarks' => in_array($row['remarks'] ?? null, ['PASSED', 'FAILED'], true) ? $row['remarks'] : null,
            ],
            'cards' => ['easy' => $int($row['easy'] ?? null), 'medium' => $int($row['medium'] ?? null), 'hard' => $int($row['hard'] ?? null), 'notseen' => $int($row['notseen'] ?? null)],
            default => null,
        };
    }

    private function str(mixed $v): ?string
    {
        return is_string($v) && $v !== '' ? mb_substr($v, 0, 2000) : (is_int($v) || is_float($v) ? (string) $v : null);
    }

    /** Only https addresses are passed on (no javascript:, data:, http:). */
    private function https(mixed $v): ?string
    {
        return is_string($v) && strlen($v) <= 2000 && str_starts_with(strtolower($v), 'https://') && filter_var($v, FILTER_VALIDATE_URL) !== false ? $v : null;
    }
}

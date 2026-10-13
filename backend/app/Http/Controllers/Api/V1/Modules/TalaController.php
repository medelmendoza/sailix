<?php

namespace App\Http\Controllers\Api\V1\Modules;

use App\Http\Controllers\Controller;
use App\Http\Requests\Modules\JoinCourseRequest;
use App\Http\Requests\Modules\LinkTalaRequest;
use App\Http\Requests\Modules\SubmitFlashcardsRequest;
use App\Http\Requests\Modules\SubmitProgressRequest;
use App\Http\Requests\Modules\SubmitQuizRequest;
use App\Models\Membership;
use App\Models\User;
use App\Modules\Tala\TalaGateway;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/** Thin: authorization is the route middleware (tenant.context + module:tala); all upstream logic is TalaGateway. */
class TalaController extends Controller
{
    public function __construct(private TalaGateway $gateway) {}

    public function link(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->gateway->status($this->membership($request))]);
    }

    public function store(LinkTalaRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json(['data' => $this->gateway->linkAccount(
            $user,
            $this->membership($request),
            $request->string('username')->toString(),
            $request->string('password')->toString(),
        )]);
    }

    public function destroy(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();
        $this->gateway->unlink($user, $this->membership($request));

        return response()->noContent();
    }

    public function courses(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->gateway->courses($this->membership($request))]);
    }

    public function course(Request $request, string $assignId): JsonResponse
    {
        return response()->json(['data' => $this->gateway->courseDetail($this->membership($request), $assignId)]);
    }

    public function material(Request $request, string $assignId, string $materialId): JsonResponse
    {
        return response()->json(['data' => $this->gateway->material($this->membership($request), $assignId, $materialId)]);
    }

    public function progress(SubmitProgressRequest $request, string $assignId): JsonResponse
    {
        /** @var list<string> $ids */
        $ids = $request->validated('completed');
        /** @var array<string, mixed> $feedback */
        $feedback = $request->validated('feedback') ?? [];

        return response()->json(['data' => $this->gateway->submitProgress($this->membership($request), $assignId, $ids, $feedback)]);
    }

    public function join(JoinCourseRequest $request): JsonResponse
    {
        return response()->json(['data' => $this->gateway->joinCourse($this->membership($request), (string) $request->validated('code'))], 202);
    }

    public function quiz(Request $request, string $assignId, string $quizId): JsonResponse
    {
        return response()->json(['data' => $this->gateway->quiz($this->membership($request), $assignId, $quizId)]);
    }

    public function attempt(SubmitQuizRequest $request, string $assignId, string $quizId): JsonResponse
    {
        /** @var list<mixed> $answers */
        $answers = $request->validated('answers');
        $version = $request->validated('version');

        return response()->json(['data' => $this->gateway->submitQuiz($this->membership($request), $assignId, $quizId, is_string($version) ? $version : null, $answers)]);
    }

    public function flashcards(Request $request, string $assignId, string $cardId): JsonResponse
    {
        return response()->json(['data' => $this->gateway->flashcards($this->membership($request), $assignId, $cardId)]);
    }

    public function ratings(SubmitFlashcardsRequest $request, string $assignId, string $cardId): JsonResponse
    {
        /** @var list<mixed> $ratings */
        $ratings = $request->validated('ratings');
        $version = $request->validated('version');

        return response()->json(['data' => $this->gateway->submitFlashcards($this->membership($request), $assignId, $cardId, is_string($version) ? $version : null, $ratings)]);
    }

    private function membership(Request $request): Membership
    {
        /** @var Membership */
        return $request->attributes->get('membership');
    }
}

<?php

namespace App\Http\Controllers\Api\V1\Modules;

use App\Http\Controllers\Controller;
use App\Http\Requests\Modules\LinkTalaRequest;
use App\Http\Requests\Modules\SubmitProgressRequest;
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

        return response()->json(['data' => $this->gateway->submitProgress($this->membership($request), $assignId, $ids)]);
    }

    private function membership(Request $request): Membership
    {
        /** @var Membership */
        return $request->attributes->get('membership');
    }
}

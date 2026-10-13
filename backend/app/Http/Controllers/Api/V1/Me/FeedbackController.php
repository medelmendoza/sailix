<?php

namespace App\Http\Controllers\Api\V1\Me;

use App\Http\Controllers\Controller;
use App\Http\Requests\SubmitFeedbackRequest;
use App\Http\Resources\FeedbackResource;
use App\Models\Feedback;
use App\Support\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;

/** Feedback about the Sailix app. The organization and member come from the authenticated context, never the body. */
class FeedbackController extends Controller
{
    public function store(SubmitFeedbackRequest $request, TenantContext $context): JsonResponse
    {
        $feedback = (new Feedback)->forceFill([
            'membership_id' => $context->membershipId(),
            'category' => $request->validated('category'),
            'message' => trim($request->validated('message')),
        ]);
        $feedback->save(); // tenant_id is stamped from the context

        return (new FeedbackResource($feedback))->response()->setStatusCode(201);
    }
}

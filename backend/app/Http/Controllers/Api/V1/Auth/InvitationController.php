<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\AcceptInvitationRequest;
use App\Identity\InvitationAccepter;
use Illuminate\Http\Response;

class InvitationController extends Controller
{
    public function accept(AcceptInvitationRequest $request, InvitationAccepter $accepter): Response
    {
        $accepter->accept($request->string('token')->toString(), $request->string('password')->toString());

        return response()->noContent();
    }
}

<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\RegisterRequest;
use App\Identity\RegisterCrew;
use Illuminate\Http\JsonResponse;

class RegisterController extends Controller
{
    public function store(RegisterRequest $request, RegisterCrew $register): JsonResponse
    {
        $register($request->validated());

        return response()->json(['data' => ['status' => 'received']], 202);
    }
}

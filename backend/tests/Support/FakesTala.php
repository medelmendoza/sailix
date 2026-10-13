<?php

namespace Tests\Support;

use App\Enums\Role;
use App\Support\Settings\SettingsRegistry;
use Illuminate\Http\Client\Factory;
use Illuminate\Support\Facades\Http;

/** Shared fixtures for the Tala gateway tests: faked DNS and HTTP, shapes observed in T0 with invented values. */
trait FakesTala
{
    private const BASE = 'https://tala.example.com';

    private const TALA_USER = 'tala-user-1';

    protected function setUpTala(): void
    {
        $this->fakeTalaDns(['tala.example.com' => ['93.184.216.34']]);
        SettingsRegistry::setPlatform('tala_api_base_url', self::BASE);
        $tenant = $this->makeTenant('SFAI');
        $this->makeMember($tenant, Role::Crew, 'crew1');
        $this->provisionModule($tenant, 'TEAM-1');
    }

    private function jwt(int $expiresIn = 31_536_000): string
    {
        $b64 = fn (array $a) => rtrim(strtr(base64_encode((string) json_encode($a)), '+/', '-_'), '=');

        return $b64(['alg' => 'HS384']).'.'.$b64(['sub' => self::TALA_USER, 'iat' => time(), 'exp' => time() + $expiresIn]).'.sig';
    }

    /** @param array<string, mixed> $overrides url-pattern => response */
    private function fakeTala(array $overrides = []): void
    {
        $assignment = [
            'assignId' => 'A1', 'courseId' => 'C1', 'dateFrom' => '2026-01-01', 'dateTo' => '2026-12-31', 'status' => 'NOT YET COMPLETED', 'progress' => '2/5',
            'course' => [
                'courseName' => 'Safety at sea', 'courseDescription' => 'Basics', 'courseThumbnailUrl' => 'https://cdn.example.com/c.png', 'courseCreator' => 'Capt. Reyes', 'totalMaterial' => '5',
                'materialDetails' => [
                    ['materialId' => 'v1', 'materialType' => 'video', 'materialName' => 'Intro video', 'materialDescription' => 'd', 'materialThumbnailUrl' => 'https://cdn.example.com/v.png'],
                    ['materialId' => 'p1', 'materialType' => 'pdf', 'materialName' => 'Manual'],
                    ['materialId' => 'q1', 'materialType' => 'up_quiz', 'materialName' => 'Quiz'],
                    ['materialId' => 'e1', 'materialType' => 'epub', 'materialName' => 'Book'],
                    ['materialId' => 'l1', 'materialType' => 'quiz', 'materialName' => 'Legacy quiz'],
                ],
            ],
        ];
        // Each call REPLACES the previous fakes (Http::fake alone appends, and the first matching stub wins).
        Http::swap(new Factory);
        Http::preventStrayRequests();
        Http::fake($overrides + [
            self::BASE.'/api/v1/login' => Http::response(['accessToken' => $this->jwt(), 'refreshToken' => 'refresh-secret', 'userId' => self::TALA_USER]),
            self::BASE.'/api/v1/auth/users/'.self::TALA_USER.'/teams' => Http::response([['teamId' => 'TEAM-1', 'teamName' => 'x'], ['teamId' => 'OTHER', 'teamName' => 'y']]),
            self::BASE.'/api/v1/auth/users/'.self::TALA_USER.'/teams/TEAM-1/courses' => Http::response([$assignment]),
            self::BASE.'/api/v1/auth/users/'.self::TALA_USER.'/teams/TEAM-1/courses/C1/sync/A1/data' => Http::response([
                'materials' => ['videos' => [['videoId' => 'v1', 'progress' => '100', 'status' => 'done']], 'pdfs' => [], 'quizzes' => [], 'cards' => [], 'epubs' => []],
            ]),
            self::BASE.'/api/v1/auth/users/teams/TEAM-1/videos/v1' => Http::response([
                'videoName' => 'Intro video', 'videoDescription' => 'd', 'videoFileUrl' => 'https://files.example.com/v.mp4', 'videoThumbnailUrl' => 'http://insecure.example.com/t.png',
            ]),
            self::BASE.'/api/v1/auth/users/teams/TEAM-1/pdf/p1' => Http::response(['pdfName' => 'Manual', 'pdfFileUrl' => 'javascript:alert(1)']),
        ]);
    }

    private function as(string $username): array
    {
        $this->app['auth']->forgetGuards();
        $token = $this->tokenFor($username);
        $this->app['auth']->forgetGuards();

        return $this->bearer($token);
    }

    private function link(array $headers, array $extra = [])
    {
        return $this->postJson('/api/v1/modules/tala/link', ['username' => 'maria', 'password' => 'tala-pass-123'] + $extra, $headers);
    }
}

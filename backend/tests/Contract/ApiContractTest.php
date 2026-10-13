<?php

namespace Tests\Contract;

use App\Enums\MembershipStatus;
use App\Enums\Role;
use App\Mail\PasswordResetLink;
use App\Models\Membership;
use App\Support\Settings\SettingsRegistry;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Osteel\OpenApi\Testing\Exceptions\ValidationException;
use Osteel\OpenApi\Testing\ValidatorBuilder;
use Osteel\OpenApi\Testing\ValidatorInterface;
use Tests\TestCase;

/**
 * Every response is validated against contracts/openapi.yaml (source of truth, ADR-0006).
 * A failing test means the implementation and the contract have drifted: fix one in the same change.
 */
class ApiContractTest extends TestCase
{
    private static ?ValidatorInterface $validator = null;

    private function ok(TestResponse $response, string $path, string $method, ?int $status = null): TestResponse
    {
        self::$validator ??= ValidatorBuilder::fromYamlFile(base_path('../contracts/openapi.yaml'))->getValidator();
        if ($status !== null) {
            $response->assertStatus($status);
        }
        self::$validator->validate($response->baseResponse, $path, strtolower($method));

        return $response;
    }

    private function fresh(): static
    {
        $this->app['auth']->forgetGuards();

        return $this;
    }

    /** @return array{0: array<string,string>, 1: object} */
    private function adminToken(): array
    {
        $tenant = $this->makeTenant('SFAI');
        [, $m] = $this->makeMember($tenant, Role::TenantAdmin, 'admin1');

        return [$this->bearer($this->tokenFor('admin1')), $m];
    }

    public function test_tala_gateway_operations(): void
    {
        $base = 'https://tala.example.com';
        $this->fakeTalaDns(['tala.example.com' => ['93.184.216.34']]);
        SettingsRegistry::setPlatform('tala_api_base_url', $base);
        $tenant = $this->makeTenant('SFAI');
        $this->makeMember($tenant, Role::Crew, 'crew1');
        $this->provisionModule($tenant, 'TEAM-1');
        $h = $this->bearer($this->tokenFor('crew1'));

        Http::fake([
            "$base/api/v1/login" => Http::response(['accessToken' => 'a.b.c', 'refreshToken' => 'r', 'userId' => 'tu1']),
            "$base/api/v1/auth/users/tu1/teams" => Http::response([['teamId' => 'TEAM-1']]),
            "$base/api/v1/auth/users/tu1/teams/TEAM-1/courses" => Http::response([[
                'assignId' => 'A1', 'courseId' => 'C1', 'status' => 'ongoing', 'progress' => '10',
                'course' => ['courseName' => 'Safety', 'materialDetails' => [
                    ['materialId' => 'v1', 'materialType' => 'video', 'materialName' => 'Intro'],
                    ['materialId' => 'q1', 'materialType' => 'up_quiz', 'materialName' => 'Quiz'],
                    ['materialId' => 'e1', 'materialType' => 'epub', 'materialName' => 'Book'],
                    ['materialId' => 'c1', 'materialType' => 'up_card', 'materialName' => 'Cards'],
                ]],
            ]]),
            "$base/api/v1/auth/users/tu1/teams/TEAM-1/courses/C1/sync/A1/data" => Http::response(['materials' => ['videos' => [['videoId' => 'v1', 'progress' => '50', 'status' => 'ongoing']]]]),
            "$base/api/v1/auth/users/teams/TEAM-1/videos/v1" => Http::response(['videoName' => 'Intro', 'videoFileUrl' => 'https://files.example.com/v.mp4']),
        ]);

        $this->ok($this->fresh()->getJson('/api/v1/modules/tala/link', $h), '/modules/tala/link', 'get', 200);
        $this->ok($this->fresh()->getJson('/api/v1/modules/tala/courses', $h), '/modules/tala/courses', 'get', 409);
        $this->ok($this->fresh()->postJson('/api/v1/modules/tala/link', [], $h), '/modules/tala/link', 'post', 422);
        $this->ok($this->fresh()->postJson('/api/v1/modules/tala/link', ['username' => 'm', 'password' => 'p'], $h), '/modules/tala/link', 'post', 200);
        $this->ok($this->fresh()->getJson('/api/v1/modules/tala/courses', $h), '/modules/tala/courses', 'get', 200);
        $this->ok($this->fresh()->getJson('/api/v1/modules/tala/courses/A1', $h), '/modules/tala/courses/{assignId}', 'get', 200);
        $this->ok($this->fresh()->getJson('/api/v1/modules/tala/courses/NOPE', $h), '/modules/tala/courses/{assignId}', 'get', 404);
        $this->ok($this->fresh()->getJson('/api/v1/modules/tala/courses/A1/materials/v1', $h), '/modules/tala/courses/{assignId}/materials/{materialId}', 'get', 200);
        $this->ok($this->fresh()->getJson('/api/v1/modules/tala/courses/A1/materials/q1', $h), '/modules/tala/courses/{assignId}/materials/{materialId}', 'get', 422);
        $this->ok($this->fresh()->postJson('/api/v1/modules/tala/courses/A1/progress', ['completed' => ['v1']], $h), '/modules/tala/courses/{assignId}/progress', 'post', 403);
        $this->ok($this->fresh()->getJson('/api/v1/modules/tala/courses/A1/quizzes/q1', $h), '/modules/tala/courses/{assignId}/quizzes/{quizId}', 'get', 403);
        $this->ok($this->fresh()->getJson('/api/v1/modules/tala/courses/A1/flashcards/c1', $h), '/modules/tala/courses/{assignId}/flashcards/{cardId}', 'get', 403);
        config(['sailix.modules.tala.progress_writes' => true]);
        Http::fake(["$base/api/v1/auth/users/tu1/teams/TEAM-1/courses/sync" => Http::response([])]);
        $this->ok($this->fresh()->postJson('/api/v1/modules/tala/courses/A1/progress', ['completed' => ['v1']], $h), '/modules/tala/courses/{assignId}/progress', 'post', 200);
        Http::fake(["$base/api/v1/auth/users/teams/TEAM-1/up_quizzes/q1" => Http::response([
            'quizId' => 'q1', 'quizName' => 'Quiz', 'quizPercentage' => '70', 'arraySection' => [['sectionId' => 's1', 'data' => [['questionType' => 'multipleChoice', 'numQuestion' => '1', 'question' => 'Q?', 'answer' => '1', 'choices' => 'a:b', 'required' => 'true']]]],
        ])]);
        Http::fake(["$base/api/v1/auth/users/teams/TEAM-1/upgraded_cards/c1" => Http::response([
            'cardId' => 'c1', 'cardName' => 'Cards', 'data' => [['question' => 'Q', 'answer' => 'A', 'questionMediaType' => 'image', 'questionMediaUploaded' => 'https://cdn.example.com/q.png'], ['question' => 'Q2', 'answer' => 'A2']],
        ])]);
        $deck = $this->ok($this->fresh()->getJson('/api/v1/modules/tala/courses/A1/flashcards/c1', $h), '/modules/tala/courses/{assignId}/flashcards/{cardId}', 'get', 200);
        $this->ok($this->fresh()->postJson('/api/v1/modules/tala/courses/A1/flashcards/c1/ratings', ['version' => $deck->json('data.version'), 'ratings' => [['index' => 0, 'rating' => 'easy'], ['index' => 1, 'rating' => 'hard']]], $h), '/modules/tala/courses/{assignId}/flashcards/{cardId}/ratings', 'post', 200);
        $this->ok($this->fresh()->postJson('/api/v1/modules/tala/courses/A1/flashcards/c1/ratings', ['ratings' => [['index' => 0, 'rating' => 'easy']]], $h), '/modules/tala/courses/{assignId}/flashcards/{cardId}/ratings', 'post', 422);
        $this->ok($this->fresh()->postJson('/api/v1/modules/tala/courses/A1/progress', ['completed' => ['v1'], 'feedback' => ['v1' => ['rating' => 4.5, 'comment' => 'ok']]], $h), '/modules/tala/courses/{assignId}/progress', 'post', 200);
        $quiz = $this->ok($this->fresh()->getJson('/api/v1/modules/tala/courses/A1/quizzes/q1', $h), '/modules/tala/courses/{assignId}/quizzes/{quizId}', 'get', 200);
        $this->ok($this->fresh()->postJson('/api/v1/modules/tala/courses/A1/quizzes/q1/attempts', ['version' => $quiz->json('data.version'), 'answers' => [['ref' => '0.0', 'value' => '1']]], $h), '/modules/tala/courses/{assignId}/quizzes/{quizId}/attempts', 'post', 200);
        $this->ok($this->fresh()->postJson('/api/v1/modules/tala/courses/A1/quizzes/q1/attempts', ['answers' => []], $h), '/modules/tala/courses/{assignId}/quizzes/{quizId}/attempts', 'post', 422);
        $this->ok($this->fresh()->postJson('/api/v1/modules/tala/courses/A1/progress', ['completed' => ['q1']], $h), '/modules/tala/courses/{assignId}/progress', 'post', 422);
        $this->ok($this->fresh()->postJson('/api/v1/modules/tala/courses/A1/progress', [], $h), '/modules/tala/courses/{assignId}/progress', 'post', 422);
        $this->ok($this->fresh()->deleteJson('/api/v1/modules/tala/link', [], $h), '/modules/tala/link', 'delete', 204);
    }

    public function test_token_auth_operations(): void
    {
        $tenant = $this->makeTenant('SFAI');
        $this->makeMember($tenant, Role::Crew, 'crew1');
        $multi = $this->makeUser('multi');
        $ma = $this->makeMembership($this->makeTenant('AAA'), $multi);
        $this->makeMembership($this->makeTenant('BBB'), $multi);
        $login = ['username' => 'crew1', 'password' => self::PASSWORD, 'device_name' => 'iPhone'];

        $r = $this->ok($this->postJson('/api/v1/auth/token', $login), '/auth/token', 'post', 200);
        $token = $r->json('data.token');
        $this->ok($this->postJson('/api/v1/auth/token', ['username' => 'crew1', 'password' => 'bad-bad-bad', 'device_name' => 'd']), '/auth/token', 'post', 401);
        $this->ok($this->postJson('/api/v1/auth/token', []), '/auth/token', 'post', 422);

        $sel = $this->ok($this->postJson('/api/v1/auth/token/select', ['ticket' => 'x', 'membership_id' => 'y']), '/auth/token/select', 'post', 401);
        $this->assertSame('invalid_ticket', $sel->json('code'));
        $ticket = $this->postJson('/api/v1/auth/token', ['username' => 'multi', 'password' => self::PASSWORD, 'device_name' => 'd']);
        $this->ok($ticket, '/auth/token', 'post', 200);
        $this->ok($this->postJson('/api/v1/auth/token/select', ['ticket' => $ticket->json('data.ticket'), 'membership_id' => $ma->id]), '/auth/token/select', 'post', 200);

        $this->fresh();
        $new = $this->ok($this->postJson('/api/v1/auth/token/refresh', [], $this->bearer($token)), '/auth/token/refresh', 'post', 200)->json('data.token');
        $this->fresh();
        $this->ok($this->postJson('/api/v1/auth/token/switch', ['membership_id' => 'nope'], $this->bearer($new)), '/auth/token/switch', 'post', 403);
        $this->fresh();
        $this->ok($this->deleteJson('/api/v1/auth/token', [], $this->bearer($new)), '/auth/token', 'delete', 204);
    }

    public function test_switch_contract(): void
    {
        $user = $this->makeUser('multi');
        $this->makeMembership($this->makeTenant('AAA'), $user);
        $mb = $this->makeMembership($this->makeTenant('BBB'), $user);
        $token = $this->tokenFor('multi', 'AAA');

        $this->ok($this->postJson('/api/v1/auth/token/switch', ['membership_id' => $mb->id], $this->bearer($token)), '/auth/token/switch', 'post', 200);
    }

    public function test_me_and_tenant_operations(): void
    {
        [$h, $m] = $this->adminToken();

        $this->ok($this->getJson('/api/v1/me', $h), '/me', 'get', 200);
        $this->fresh();
        $this->ok($this->getJson('/api/v1/me'), '/me', 'get', 401);
        $this->fresh();
        $this->ok($this->getJson('/api/v1/tenant', $h), '/tenant', 'get', 200);
        $this->fresh();
        $this->ok($this->patchJson('/api/v1/tenant', ['settings' => ['display_name' => 'Southfield']], $h), '/tenant', 'patch', 200);
        $this->fresh();
        $this->ok($this->patchJson('/api/v1/tenant', ['settings' => ['bogus' => 1]], $h), '/tenant', 'patch', 422);
        $this->fresh();
        $this->ok($this->getJson('/api/v1/tenant/users', $h), '/tenant/users', 'get', 200);
        $this->fresh();
        $this->ok($this->getJson('/api/v1/tenant/audit-logs', $h), '/tenant/audit-logs', 'get', 200);
        $this->fresh();
        $this->ok($this->patchJson("/api/v1/tenant/users/{$m->id}", ['status' => 'suspended'], $h), '/tenant/users/{membership}', 'patch', 409);
        $this->fresh();
        $this->ok($this->patchJson('/api/v1/tenant/users/'.Str::uuid(), ['status' => 'suspended'], $h), '/tenant/users/{membership}', 'patch', 404);
    }

    public function test_tenant_forbidden_and_user_update(): void
    {
        $tenant = $this->makeTenant('SFAI');
        $this->makeMember($tenant, Role::TenantAdmin, 'admin1');
        [, $crew] = $this->makeMember($tenant, Role::Crew, 'crew1');
        $this->fresh();
        $this->ok($this->getJson('/api/v1/tenant', $this->bearer($this->tokenFor('crew1'))), '/tenant', 'get', 403);

        $this->fresh();
        $h = $this->bearer($this->tokenFor('admin1'));
        $this->ok($this->patchJson("/api/v1/tenant/users/{$crew->id}", ['status' => 'suspended'], $h), '/tenant/users/{membership}', 'patch', 200);
    }

    public function test_session_and_invitation_operations(): void
    {
        $this->makeMember($this->makeTenant('SFAI'), Role::TenantAdmin, 'admin1');

        $login = $this->spa()->postJson('/api/v1/auth/session', ['username' => 'admin1', 'password' => self::PASSWORD]);
        $this->ok($login, '/auth/session', 'post', 200);
        $this->ok($this->fresh()->spa()->postJson('/api/v1/auth/session', ['username' => 'admin1', 'password' => 'bad-bad-bad']), '/auth/session', 'post', 401);
        $this->ok($this->fresh()->spa()->postJson('/api/v1/auth/session/select', ['ticket' => 'x', 'membership_id' => 'y']), '/auth/session/select', 'post', 401);
        $this->ok($this->fresh()->postJson('/api/v1/auth/invitations/accept', ['token' => 'bad', 'password' => 'abcdefghij', 'password_confirmation' => 'abcdefghij']), '/auth/invitations/accept', 'post', 422);

        $out = $this->carrySession($login)->fresh()->spa()->deleteJson('/api/v1/auth/session');
        $this->ok($out, '/auth/session', 'delete', 204);
    }

    public function test_platform_operations(): void
    {
        Mail::fake();
        [, $secret] = $this->makePlatformAdmin();
        $login = $this->spa()->postJson('/api/v1/platform/auth/session', ['email' => 'root@example.test', 'password' => self::PASSWORD, 'otp' => $this->otp($secret)]);
        $this->ok($login, '/platform/auth/session', 'post', 200);
        $this->ok($this->fresh()->spa()->postJson('/api/v1/platform/auth/session', ['email' => 'root@example.test', 'password' => 'bad-bad-bad', 'otp' => '123456']), '/platform/auth/session', 'post', 401);
        $this->carrySession($login);

        $p = fn () => $this->fresh()->spa();

        $this->ok($p()->getJson('/api/v1/platform/me'), '/platform/me', 'get', 200);
        $created = $this->ok($p()->postJson('/api/v1/platform/tenants', ['code' => 'SFAI', 'name' => 'Southfield']), '/platform/tenants', 'post', 201);
        $id = $created->json('data.id');
        $this->ok($p()->postJson('/api/v1/platform/tenants', ['code' => 'x', 'name' => '']), '/platform/tenants', 'post', 422);
        $this->ok($p()->getJson('/api/v1/platform/tenants?filter[status]=provisioning'), '/platform/tenants', 'get', 200);
        $this->ok($p()->getJson("/api/v1/platform/tenants/$id"), '/platform/tenants/{tenant}', 'get', 200);
        $this->ok($p()->getJson('/api/v1/platform/tenants/'.Str::uuid()), '/platform/tenants/{tenant}', 'get', 404);
        $this->ok($p()->patchJson("/api/v1/platform/tenants/$id", ['name' => 'Southfield Agencies']), '/platform/tenants/{tenant}', 'patch', 200);

        $this->ok($p()->postJson("/api/v1/platform/tenants/$id/activate"), '/platform/tenants/{tenant}/{action}', 'post', 422);
        $inv = $this->ok($p()->postJson("/api/v1/platform/tenants/$id/admins", ['email' => 'boss@example.test']), '/platform/tenants/{tenant}/admins', 'post', 201);
        $this->ok($p()->postJson("/api/v1/platform/tenants/$id/admins", ['email' => 'not-an-email']), '/platform/tenants/{tenant}/admins', 'post', 422);
        $this->ok($p()->getJson("/api/v1/platform/tenants/$id/admins"), '/platform/tenants/{tenant}/admins', 'get', 200);
        $this->postJson('/api/v1/auth/invitations/accept', ['token' => $inv->json('meta.invitation_token'), 'password' => 'Str0ng-passphrase-1', 'password_confirmation' => 'Str0ng-passphrase-1'])->assertNoContent();
        $this->ok($p()->postJson("/api/v1/platform/tenants/$id/activate"), '/platform/tenants/{tenant}/{action}', 'post', 200);
        $this->ok($p()->postJson("/api/v1/platform/tenants/$id/activate"), '/platform/tenants/{tenant}/{action}', 'post', 409);

        $this->ok($p()->getJson('/api/v1/platform/settings'), '/platform/settings', 'get', 200);
        $this->ok($p()->patchJson('/api/v1/platform/settings', ['settings' => ['password_min_length' => 10]]), '/platform/settings', 'patch', 200);
        $this->ok($p()->patchJson('/api/v1/platform/settings', ['settings' => ['display_name' => 'x']]), '/platform/settings', 'patch', 422);
        $this->ok($p()->getJson('/api/v1/platform/audit-logs?per_page=5'), '/platform/audit-logs', 'get', 200);

        $out = $p()->deleteJson('/api/v1/platform/auth/session');
        $this->ok($out, '/platform/auth/session', 'delete', 204);
        $this->ok($this->carrySession($out)->fresh()->spa()->getJson('/api/v1/platform/tenants'), '/platform/tenants', 'get', 401);
    }

    public function test_membership_states_in_listings_conform(): void
    {
        $tenant = $this->makeTenant('SFAI');
        $this->makeMember($tenant, Role::TenantAdmin, 'admin1');
        $this->makeMember($tenant, Role::Crew, 'p', MembershipStatus::Pending);
        $this->fresh();

        $this->ok($this->getJson('/api/v1/tenant/users?per_page=1&page=2', $this->bearer($this->tokenFor('admin1'))), '/tenant/users', 'get', 200);
    }

    public function test_module_operations_conform(): void
    {
        $this->fakeTalaDns(['tala.example.com' => ['93.184.216.34']]);
        $tenant = $this->makeTenant('SFAI');
        $other = $this->makeTenant('OTHER');
        $this->makeMember($tenant, Role::TenantAdmin, 'admin1');
        [, $secret] = $this->makePlatformAdmin();
        $login = $this->spa()->postJson('/api/v1/platform/auth/session', ['email' => 'root@example.test', 'password' => self::PASSWORD, 'otp' => $this->otp($secret)]);
        $this->ok($login, '/platform/auth/session', 'post', 200);
        $this->carrySession($login);
        $p = fn () => $this->fresh()->spa();
        $base = "/api/v1/platform/tenants/{$tenant->id}/modules";

        $this->ok($p()->getJson($base), '/platform/tenants/{tenant}/modules', 'get', 200);
        $this->ok($p()->putJson("$base/tala", ['external_team_id' => 'TEAM-1']), '/platform/tenants/{tenant}/modules/{module}', 'put', 200);
        $this->ok($p()->putJson("$base/tala", ['external_team_id' => 'bad team!']), '/platform/tenants/{tenant}/modules/{module}', 'put', 422);
        $this->ok($p()->putJson("/api/v1/platform/tenants/{$other->id}/modules/tala", ['external_team_id' => 'TEAM-1']), '/platform/tenants/{tenant}/modules/{module}', 'put', 409);
        $this->ok($p()->putJson('/api/v1/platform/tenants/'.Str::uuid().'/modules/tala', ['external_team_id' => 'T']), '/platform/tenants/{tenant}/modules/{module}', 'put', 404);
        $this->ok($p()->getJson('/api/v1/platform/tenants/'.Str::uuid().'/modules'), '/platform/tenants/{tenant}/modules', 'get', 404);

        $this->ok($p()->patchJson('/api/v1/platform/settings', ['settings' => ['tala_api_base_url' => 'https://tala.example.com']]), '/platform/settings', 'patch', 200);
        $this->ok($p()->patchJson('/api/v1/platform/settings', ['settings' => ['tala_api_base_url' => 'http://tala.example.com']]), '/platform/settings', 'patch', 422);
        $this->ok($p()->getJson('/api/v1/platform/settings'), '/platform/settings', 'get', 200);

        $h = $this->bearer($this->tokenFor('admin1'));
        $this->ok($this->fresh()->getJson('/api/v1/tenant/modules', $h), '/tenant/modules', 'get', 200);
        $this->ok($this->fresh()->putJson('/api/v1/tenant/modules/tala', ['enabled' => true], $h), '/tenant/modules/{module}', 'put', 200);
        $this->ok($this->fresh()->putJson('/api/v1/tenant/modules/tala', ['enabled' => 'x'], $h), '/tenant/modules/{module}', 'put', 422);
        $this->ok($this->fresh()->putJson('/api/v1/tenant/modules/srt', ['enabled' => true], $h), '/tenant/modules/{module}', 'put', 404);
        $this->ok($this->fresh()->getJson('/api/v1/me', $h), '/me', 'get', 200);
    }

    public function test_module_endpoints_forbidden_and_conflict_conform(): void
    {
        $tenant = $this->makeTenant('SFAI');
        $this->makeMember($tenant, Role::Crew, 'crew1');
        $this->makeMember($tenant, Role::TenantAdmin, 'admin1');

        $crew = $this->bearer($this->tokenFor('crew1'));
        $this->ok($this->fresh()->getJson('/api/v1/tenant/modules', $crew), '/tenant/modules', 'get', 403);
        $this->ok($this->fresh()->putJson('/api/v1/tenant/modules/tala', ['enabled' => true], $crew), '/tenant/modules/{module}', 'put', 403);

        $admin = $this->bearer($this->tokenFor('admin1'));
        $this->ok($this->fresh()->putJson('/api/v1/tenant/modules/tala', ['enabled' => true], $admin), '/tenant/modules/{module}', 'put', 409);
        $this->ok($this->fresh()->getJson('/api/v1/tenant/modules'), '/tenant/modules', 'get', 401);
    }

    public function test_account_lifecycle_operations_conform(): void
    {
        Mail::fake();
        $tenant = $this->makeTenant('SFAI');
        $this->makeMember($tenant, Role::TenantAdmin, 'admin1');
        $this->makeMember($tenant, Role::Crew, 'crew1');
        $reg = fn (array $o = []) => $this->fresh()->postJson('/api/v1/auth/register', $o + [
            'agency_code' => 'SFAI', 'username' => 'new.person', 'email' => 'new@example.test',
            'password' => 'a-long-enough-pass', 'password_confirmation' => 'a-long-enough-pass',
            'first_name' => 'New', 'last_name' => 'Person', 'mobile' => '+63 900 000 0000',
        ]);

        $this->ok($reg(), '/auth/register', 'post', 202);
        $this->app['cache']->store()->flush();
        $this->ok($reg(['agency_code' => 'NOPE', 'email' => 'x@example.test']), '/auth/register', 'post', 422);
        $this->app['cache']->store()->flush();
        $this->ok($reg(['first_name' => '', 'email' => 'y@example.test']), '/auth/register', 'post', 422);

        $this->app['cache']->store()->flush();
        $this->ok($this->fresh()->postJson('/api/v1/auth/forgot-password', ['email' => 'crew1@example.test']), '/auth/forgot-password', 'post', 202);
        $this->ok($this->fresh()->postJson('/api/v1/auth/forgot-password', ['email' => 'nope']), '/auth/forgot-password', 'post', 422);
        $mail = Mail::queued(PasswordResetLink::class)->first();
        parse_str((string) parse_url($mail->url, PHP_URL_QUERY), $q);
        $this->ok($this->fresh()->postJson('/api/v1/auth/reset-password', ['email' => 'crew1@example.test', 'token' => 'bad', 'password' => 'a-long-enough-pass', 'password_confirmation' => 'a-long-enough-pass']), '/auth/reset-password', 'post', 422);
        $this->ok($this->fresh()->postJson('/api/v1/auth/reset-password', ['email' => $q['email'], 'token' => $q['token'], 'password' => 'a-long-enough-pass', 'password_confirmation' => 'a-long-enough-pass']), '/auth/reset-password', 'post', 204);

        $change = ['current_password' => self::PASSWORD, 'password' => 'another-long-pass', 'password_confirmation' => 'another-long-pass'];
        // password was reset above; sign in with the new one
        $crew = $this->bearer($this->fresh()->postJson('/api/v1/auth/token', ['username' => 'crew1', 'password' => 'a-long-enough-pass', 'device_name' => 'd'])->json('data.token'));
        $change['current_password'] = 'a-long-enough-pass';
        $this->ok($this->fresh()->putJson('/api/v1/me/password', $change, $crew), '/me/password', 'put', 204);
        $this->ok($this->fresh()->putJson('/api/v1/me/password', ['current_password' => 'wrong-wrong'] + $change, $crew), '/me/password', 'put', 422);
        $this->ok($this->fresh()->putJson('/api/v1/me/password', $change), '/me/password', 'put', 401);

        $this->ok($this->fresh()->postJson('/api/v1/me/deletion-request', [], $crew), '/me/deletion-request', 'post', 202);
        $this->ok($this->fresh()->postJson('/api/v1/me/deletion-request'), '/me/deletion-request', 'post', 401);
        $this->ok($this->fresh()->getJson('/api/v1/tenant/deletion-requests', $crew), '/tenant/deletion-requests', 'get', 403);

        $admin = $this->bearer($this->tokenFor('admin1'));
        $this->ok($this->fresh()->getJson('/api/v1/tenant/deletion-requests', $admin), '/tenant/deletion-requests', 'get', 200);
        $this->ok($this->fresh()->getJson('/api/v1/tenant/users?filter[status]=pending', $admin), '/tenant/users', 'get', 200);
        $this->ok($this->fresh()->getJson('/api/v1/me', $admin), '/me', 'get', 200);
    }

    public function test_me_with_a_profile_conforms(): void
    {
        Mail::fake();
        $tenant = $this->makeTenant('SFAI');
        [, $admin] = $this->makeMember($tenant, Role::TenantAdmin, 'admin1');
        $this->postJson('/api/v1/auth/register', [
            'agency_code' => 'SFAI', 'username' => 'new.person', 'email' => 'new@example.test',
            'password' => 'a-long-enough-pass', 'password_confirmation' => 'a-long-enough-pass', 'first_name' => 'New', 'last_name' => 'Person',
        ])->assertStatus(202);
        $id = Membership::withoutTenantScope()->where('status', 'pending')->firstOrFail()->id;
        $h = $this->bearer($this->tokenFor('admin1'));
        $this->fresh()->patchJson("/api/v1/tenant/users/$id", ['status' => 'active'], $h)->assertOk();

        $token = $this->fresh()->postJson('/api/v1/auth/token', ['username' => 'new.person', 'password' => 'a-long-enough-pass', 'device_name' => 'd'])->json('data.token');
        $me = $this->ok($this->fresh()->getJson('/api/v1/me', $this->bearer($token)), '/me', 'get', 200);
        $this->assertSame('New', $me->json('data.profile.first_name'));
    }

    /** Guards the guard: the validator must actually reject a payload that does not match the contract. */
    public function test_validator_rejects_a_mismatching_response(): void
    {
        $this->makeMember($this->makeTenant('SFAI'), Role::TenantAdmin, 'admin1');
        $me = $this->getJson('/api/v1/me', $this->bearer($this->tokenFor('admin1')))->assertOk();

        $this->expectException(ValidationException::class);
        $this->ok($me, '/tenant', 'get'); // a /me payload is not a TenantDetail
    }
}

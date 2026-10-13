<?php

namespace Tests\Feature;

use App\Enums\LinkStatus;
use App\Enums\Role;
use App\Models\ExternalIdentity;
use App\Models\ModuleLink;
use App\Models\Tenant;
use App\Modules\Module;
use Illuminate\Encryption\Encrypter;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** Key rotation and incident wipe for encrypted external-account tokens (docs/14). */
class ModuleTokenKeeperTest extends TestCase
{
    /** @return array{0: Tenant, 1: ModuleLink} */
    private function link(string $code, string $user, string $team): array
    {
        $tenant = $this->makeTenant($code);
        [$u, $m] = $this->makeMember($tenant, Role::Crew, $user);
        $this->provisionModule($tenant, $team);
        $identity = (new ExternalIdentity)->forceFill(['user_id' => $u->getKey(), 'module' => Module::Tala->value, 'external_user_id' => "ext-$user"]);
        $identity->save();
        $link = (new ModuleLink)->forceFill([
            'tenant_id' => $tenant->getKey(), 'membership_id' => $m->getKey(), 'module' => Module::Tala->value,
            'external_identity_id' => $identity->getKey(), 'external_team_id' => $team, 'status' => LinkStatus::Linked,
            'access_token' => "access-$user", 'refresh_token' => "refresh-$user", 'token_expires_at' => now()->addYear(),
        ]);
        $link->save();

        return [$tenant, $link];
    }

    private function rotateKey(array $previous): string
    {
        $new = 'base64:'.base64_encode(random_bytes(32));
        config(['app.key' => $new, 'app.previous_keys' => $previous]);
        $this->app->forgetInstance('encrypter');
        Crypt::clearResolvedInstance('encrypter');

        return $new;
    }

    private function raw(string $column = 'access_token'): string
    {
        return (string) DB::table('module_links')->orderBy('id')->value($column);
    }

    private function decryptsWith(string $key, string $payload): bool
    {
        try {
            (new Encrypter(base64_decode(substr($key, 7)), config('app.cipher')))->decryptString($payload);

            return true;
        } catch (\Throwable) {
            return false;
        }
    }

    public function test_tokens_survive_a_key_rotation_and_are_then_moved_to_the_new_key(): void
    {
        $this->link('SFAI', 'crew1', 'TEAM-1');
        $oldKey = config('app.key');
        $newKey = $this->rotateKey([$oldKey]);

        // 1. with the old key in APP_PREVIOUS_KEYS the application still reads the token
        $this->assertSame('access-crew1', ModuleLink::withoutTenantScope()->firstOrFail()->access_token);
        $this->assertTrue($this->decryptsWith($oldKey, $this->raw()));
        $this->assertFalse($this->decryptsWith($newKey, $this->raw()));

        // 2. re-encrypting writes them under the new key only
        $this->artisan('sailix:tokens:reencrypt')->expectsOutputToContain('Re-encrypted 1 link(s).')->assertSuccessful();
        $this->assertTrue($this->decryptsWith($newKey, $this->raw()));
        $this->assertTrue($this->decryptsWith($newKey, $this->raw('refresh_token')));
        $this->assertFalse($this->decryptsWith($oldKey, $this->raw()));

        // 3. the old key can now be dropped
        $this->rotateKey([]);
        $this->app['config']->set('app.key', $newKey);
        $this->app->forgetInstance('encrypter');
        Crypt::clearResolvedInstance('encrypter');
        $this->assertSame('access-crew1', ModuleLink::withoutTenantScope()->firstOrFail()->access_token);
        $this->assertSame('refresh-crew1', ModuleLink::withoutTenantScope()->firstOrFail()->refresh_token);
    }

    public function test_tokens_under_a_lost_key_are_reported_and_can_be_invalidated(): void
    {
        $this->link('SFAI', 'crew1', 'TEAM-1');
        $this->rotateKey([]); // the old key was dropped without re-encrypting

        $this->artisan('sailix:tokens:reencrypt')->expectsOutputToContain('could not be decrypted')->assertFailed();
        $this->assertSame(LinkStatus::Linked, ModuleLink::withoutTenantScope()->firstOrFail()->status); // nothing changed silently

        $this->artisan('sailix:tokens:reencrypt', ['--invalidate-unreadable' => true])->assertSuccessful();
        $link = ModuleLink::withoutTenantScope()->firstOrFail();
        $this->assertSame(LinkStatus::NeedsRelink, $link->status);
        $this->assertNull(DB::table('module_links')->value('access_token'));
        $this->assertNull(DB::table('module_links')->value('refresh_token'));
    }

    public function test_wipe_removes_tokens_for_one_organization_or_all_and_asks_users_to_link_again(): void
    {
        $this->link('SFAI', 'crew1', 'TEAM-1');
        $this->link('ACME', 'crew2', 'TEAM-2');

        $this->artisan('sailix:tokens:wipe')->expectsOutputToContain('exactly one of')->assertFailed();
        $this->artisan('sailix:tokens:wipe', ['--tenant' => 'SFAI', '--all' => true, '--force' => true])->assertFailed();

        $this->artisan('sailix:tokens:wipe', ['--tenant' => 'sfai', '--force' => true])->expectsOutputToContain('Wiped 1 link(s).')->assertSuccessful();
        $rows = DB::table('module_links')->join('tenants', 'tenants.id', '=', 'module_links.tenant_id')->pluck('module_links.access_token', 'tenants.code');
        $this->assertNull($rows['SFAI']);
        $this->assertNotNull($rows['ACME']);
        $this->assertSame('needs_relink', DB::table('module_links')->join('tenants', 'tenants.id', '=', 'module_links.tenant_id')->where('tenants.code', 'SFAI')->value('module_links.status'));

        $this->artisan('sailix:tokens:wipe', ['--all' => true, '--force' => true])->assertSuccessful();
        $this->assertSame(0, DB::table('module_links')->whereNotNull('access_token')->count());
        $this->assertDatabaseHas('audit_logs', ['action' => 'platform.module_tokens_wiped']);
    }

    public function test_the_commands_never_print_token_values(): void
    {
        $this->link('SFAI', 'crew1', 'TEAM-1');
        $this->artisan('sailix:tokens:reencrypt')->doesntExpectOutputToContain('access-crew1')->assertSuccessful();
    }
}

<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\TenantStatus;
use App\Models\AuditLog;
use App\Models\Tenant;
use App\Models\TenantBranding;
use App\Support\Tenancy\TenantContext;
use App\Tenancy\ColorContrast;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class TenantBrandingTest extends TestCase
{
    private Tenant $a;

    private Tenant $b;

    protected function setUp(): void
    {
        parent::setUp();
        $this->app['url']->forceRootUrl('http://localhost'); // see TenantAddressingTest
        Storage::fake('local');
        config(['sailix.documents.disk' => 'local']);
        $this->a = $this->makeTenant('AAA');
        $this->b = $this->makeTenant('BBB');
        $this->makeMember($this->a, Role::TenantAdmin, 'adminA');
        $this->makeMember($this->a, Role::Crew, 'crewA');
        $this->makeMember($this->b, Role::TenantAdmin, 'adminB');
    }

    /** A real picture, so its content (not its name) decides what it is. */
    private function picture(string $type = 'png', int $w = 900, int $h = 600, string $name = 'logo'): UploadedFile
    {
        $img = imagecreatetruecolor($w, $h);
        imagefill($img, 0, 0, imagecolorallocate($img, 53, 93, 173));
        ob_start();
        $type === 'png' ? imagepng($img) : imagejpeg($img);
        $bytes = (string) ob_get_clean();

        return $this->realUpload("$name.$type", $bytes);
    }

    private function change(string $as, array $body)
    {
        return $this->patchJson('/api/v1/tenant/branding', $body, $this->as($as));
    }

    private function upload(string $as, string $kind, UploadedFile $file)
    {
        return $this->post("/api/v1/tenant/branding/$kind", ['file' => $file], $this->as($as) + ['Accept' => 'application/json']);
    }

    private function publicLook(string $host)
    {
        return $this->getJson("http://$host/api/v1/public/tenant");
    }

    public function test_without_any_branding_the_public_look_is_the_platform_default(): void
    {
        $data = $this->publicLook('aaa.sailix.test')->assertOk()->json('data');

        $this->assertSame('AAA Agency', $data['name']);
        $this->assertNull($data['tagline']);
        $this->assertNull($data['logo_url']);
        $this->assertNull($data['primary_color']);
    }

    public function test_an_administrator_sets_the_tagline_and_colours_and_the_public_look_follows(): void
    {
        $r = $this->change('adminA', ['tagline' => 'Sailing since 1990', 'primary_color' => '#355dad', 'secondary_color' => '#1f6b4a'])->assertOk();
        $this->assertSame('#355DAD', $r->json('data.primary_color')); // stored in one spelling

        $look = $this->publicLook('aaa.sailix.test')->json('data');
        $this->assertSame('Sailing since 1990', $look['tagline']);
        $this->assertSame('#1F6B4A', $look['secondary_color']);
        $this->assertNull($this->publicLook('bbb.sailix.test')->json('data.primary_color')); // another organization's look is its own
    }

    public function test_the_display_name_setting_is_the_public_name(): void
    {
        $this->patchJson('/api/v1/tenant', ['settings' => ['display_name' => 'Southfield Agencies']], $this->as('adminA'))->assertOk();

        $this->assertSame('Southfield Agencies', $this->publicLook('aaa.sailix.test')->json('data.name'));
        $this->assertSame('BBB Agency', $this->publicLook('bbb.sailix.test')->json('data.name'));
    }

    public function test_colours_must_be_hex_and_dark_enough_for_white_text(): void
    {
        foreach (['red', '#12', '#GGGGGG', '355dad', '#35 5dad', '#ffffff', '#ffff00', '#cccccc'] as $bad) {
            $this->change('adminA', ['primary_color' => $bad])->assertStatus(422)->assertJsonValidationErrors('primary_color');
        }
        $this->change('adminA', ['secondary_color' => '#ffeeaa'])->assertStatus(422)->assertJsonValidationErrors('secondary_color');
        $this->change('adminA', ['primary_color' => '#000000'])->assertOk(); // dark is always fine
        $this->assertSame(1.05 / (0.0 + 0.05), ColorContrast::againstWhite('#000000'));
    }

    public function test_text_cannot_carry_markup_and_an_empty_value_clears_a_field(): void
    {
        foreach (['<b>x</b>', 'a > b', "line\nbreak", '<script>alert(1)</script>'] as $bad) {
            $this->change('adminA', ['tagline' => $bad])->assertStatus(422)->assertJsonValidationErrors('tagline');
        }
        $this->change('adminA', ['tagline' => str_repeat('x', 121)])->assertStatus(422);

        $this->change('adminA', ['tagline' => 'Hello', 'primary_color' => '#355dad'])->assertOk();
        $this->change('adminA', ['tagline' => '', 'primary_color' => null])->assertOk();
        $look = $this->publicLook('aaa.sailix.test')->json('data');
        $this->assertNull($look['tagline']);
        $this->assertNull($look['primary_color']);
    }

    public function test_only_the_organizations_own_administrators_change_it(): void
    {
        $this->change('crewA', ['tagline' => 'x'])->assertForbidden();
        $this->getJson('/api/v1/tenant/branding', $this->as('crewA'))->assertForbidden();
        $this->upload('crewA', 'logo', $this->picture())->assertForbidden();

        $this->change('adminB', ['tagline' => 'Bee'])->assertOk();
        $this->assertNull($this->publicLook('aaa.sailix.test')->json('data.tagline')); // adminB cannot reach A: there is no id to send
    }

    public function test_a_logo_is_shrunk_and_served_publicly_under_the_organizations_own_slug(): void
    {
        $r = $this->upload('adminA', 'logo', $this->picture('png', 900, 600))->assertOk();
        $url = $r->json('data.logo_url');
        $this->assertStringStartsWith('http://localhost/api/v1/public/tenants/aaa/logo?v=', $url);

        $res = $this->get('http://api.sailix.test/api/v1/public/tenants/aaa/logo');
        $res->assertOk()->assertHeader('Content-Type', 'image/png')->assertHeader('X-Content-Type-Options', 'nosniff');
        [$w, $h] = getimagesizefromstring($res->streamedContent());
        $this->assertSame(512, max($w, $h)); // never larger than 512
        $this->assertSame(341, min($w, $h));  // same shape

        $this->get('http://api.sailix.test/api/v1/public/tenants/bbb/logo')->assertNotFound(); // B has none
    }

    public function test_a_small_logo_is_not_enlarged_and_a_jpeg_stays_a_jpeg(): void
    {
        $this->upload('adminA', 'logo', $this->picture('jpg', 200, 100))->assertOk();
        $res = $this->get('http://api.sailix.test/api/v1/public/tenants/aaa/logo')->assertOk()->assertHeader('Content-Type', 'image/jpeg');
        $this->assertSame([200, 100], array_slice(getimagesizefromstring($res->streamedContent()), 0, 2));

        $this->upload('adminA', 'favicon', $this->picture('png', 400, 400, 'fav'))->assertOk();
        $fav = $this->get('http://api.sailix.test/api/v1/public/tenants/aaa/favicon')->assertOk();
        $this->assertSame(128, getimagesizefromstring($fav->streamedContent())[0]);
    }

    public function test_only_real_jpeg_and_png_pictures_are_accepted(): void
    {
        $this->upload('adminA', 'logo', $this->realUpload('logo.png', '<?php echo 1;'))->assertStatus(422);
        $this->upload('adminA', 'logo', $this->realUpload('logo.svg', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))->assertStatus(422);
        $this->upload('adminA', 'logo', $this->realUpload('logo.png', '%PDF-1.4 not a picture'))->assertStatus(422);
        $this->post('/api/v1/tenant/branding/banner', ['file' => $this->picture()], $this->as('adminA') + ['Accept' => 'application/json'])->assertNotFound(); // only logo and favicon
        $this->assertNull(TenantBranding::find($this->a->id)?->logo_path);
    }

    public function test_the_version_changes_with_every_change_so_browsers_refetch_the_image(): void
    {
        $v1 = $this->upload('adminA', 'logo', $this->picture())->json('data.version');
        $v2 = $this->upload('adminA', 'logo', $this->picture('jpg'))->json('data.version');
        $v3 = $this->change('adminA', ['tagline' => 'x'])->json('data.version');

        $this->assertGreaterThan($v1, $v2);
        $this->assertGreaterThan($v2, $v3);
    }

    public function test_replacing_or_removing_an_image_deletes_the_old_file(): void
    {
        $this->upload('adminA', 'logo', $this->picture())->assertOk();
        $first = TenantBranding::find($this->a->id)->logo_path;
        Storage::disk('local')->assertExists($first);

        $this->upload('adminA', 'logo', $this->picture('jpg'))->assertOk();
        $second = TenantBranding::find($this->a->id)->logo_path;
        Storage::disk('local')->assertMissing($first);
        Storage::disk('local')->assertExists($second);
        $this->assertStringStartsWith('branding/'.$this->a->id.'/logo-', $second); // in the organization's own folder, random name

        $this->deleteJson('/api/v1/tenant/branding/logo', [], $this->as('adminA'))->assertOk()->assertJsonPath('data.logo_url', null);
        Storage::disk('local')->assertMissing($second);
        $this->get('http://api.sailix.test/api/v1/public/tenants/aaa/logo')->assertNotFound();
    }

    public function test_the_audit_trail_names_the_fields_changed_never_their_values(): void
    {
        $this->change('adminA', ['tagline' => 'A very private slogan', 'primary_color' => '#355dad'])->assertOk();

        $rows = AuditLog::query()->tap(fn () => app(TenantContext::class)->markPlatform())->where('action', 'tenant.branding_updated')->get();
        $this->assertCount(1, $rows);
        $this->assertStringNotContainsString('private slogan', json_encode($rows[0]->metadata));
        $this->assertStringContainsString('tagline', json_encode($rows[0]->metadata));
    }

    public function test_an_organization_that_is_switched_off_shows_no_images(): void
    {
        $this->upload('adminA', 'logo', $this->picture())->assertOk();
        $this->a->forceFill(['status' => TenantStatus::Suspended])->save();

        $this->get('http://api.sailix.test/api/v1/public/tenants/aaa/logo')->assertNotFound();
    }
}

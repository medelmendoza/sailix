<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * How an organization is addressed and how it looks: a slug (its default address), domains it may be reached on, and
 * its branding. The slug starts as the lowercase agency code; the agency code itself keeps working everywhere.
 */
return new class extends Migration
{
    private const RESERVED = ['www', 'api', 'admin', 'platform', 'app', 'mail', 'static', 'assets', 'cdn', 'sailix', 'login', 'status', 'help', 'support'];

    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->string('slug', 40)->nullable()->after('code');
        });

        $taken = [];
        foreach (DB::table('tenants')->orderBy('created_at')->orderBy('id')->get(['id', 'code']) as $row) {
            $base = Str::of(strtolower($row->code))->replaceMatches('/[^a-z0-9-]/', '')->trim('-')->toString();
            if (strlen($base) < 3 || in_array($base, self::RESERVED, true)) {
                $base = ($base === '' ? 'org' : $base).'-org'; // short or reserved codes: "ab" becomes "ab-org"
            }
            $slug = substr($base, 0, 40);
            for ($n = 2; isset($taken[$slug]); $n++) {
                $slug = substr($base, 0, 36).'-'.$n;
            }
            $taken[$slug] = true;
            DB::table('tenants')->where('id', $row->id)->update(['slug' => $slug]);
        }

        Schema::table('tenants', function (Blueprint $table) {
            $table->string('slug', 40)->nullable(false)->unique()->change();
        });

        Schema::create('tenant_domains', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->string('domain', 253); // canonical form (lowercase, punycode, no port, no leading www)
            $table->string('verification_token', 64);
            $table->timestamp('verified_at')->nullable();
            // Set to the domain itself once verified, NULL before: a unique index over it means at most one
            // organization can own a verified domain, while several may have an unverified claim on it.
            $table->string('verified_domain', 253)->nullable()->unique();
            $table->timestamps();

            $table->unique(['tenant_id', 'domain']);
            $table->index('domain');
        });

        Schema::create('tenant_branding', function (Blueprint $table) {
            $table->foreignUuid('tenant_id')->primary()->constrained('tenants')->cascadeOnDelete();
            $table->string('tagline', 120)->nullable();
            $table->char('primary_color', 7)->nullable();
            $table->char('secondary_color', 7)->nullable();
            $table->string('logo_path', 255)->nullable();
            $table->string('logo_mime', 40)->nullable();
            $table->string('favicon_path', 255)->nullable();
            $table->string('favicon_mime', 40)->nullable();
            $table->unsignedInteger('version')->default(1); // bumped on every change: lets the browser refetch images
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tenant_branding');
        Schema::dropIfExists('tenant_domains');
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropUnique(['slug']);
            $table->dropColumn('slug');
        });
    }
};

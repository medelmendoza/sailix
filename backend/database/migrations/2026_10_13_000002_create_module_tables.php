<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Platform-provisioned entitlement of a module for one organization, bound to ONE team of the
        // external system. The platform (not the tenant) sets external_team_id.
        Schema::create('tenant_modules', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained('tenants');
            $table->string('module', 32);
            $table->string('status', 20);
            $table->string('external_team_id', 64)->collation('utf8mb4_bin')->nullable();
            $table->json('config')->nullable(); // never secrets
            $table->timestamps();

            $table->unique(['tenant_id', 'module']);
            $table->unique(['tenant_id', 'id']);
            // Parent key for module_links: a link may only reference the organization's own mapped team.
            $table->unique(['tenant_id', 'module', 'external_team_id']);
            // One external team belongs to at most one organization (NULLs, i.e. unmapped rows, are exempt).
            $table->unique(['module', 'external_team_id']);
        });

        // Identity-level (no tenant_id): one external account can be claimed by ONE Sailix user, ever.
        Schema::create('external_identities', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained('users');
            $table->string('module', 32);
            $table->string('external_user_id', 64)->collation('utf8mb4_bin');
            $table->timestamps();

            $table->unique(['module', 'external_user_id']);
            $table->unique(['user_id', 'module']);
        });

        // Per-membership link to the external account, pinned to the organization's mapped team.
        Schema::create('module_links', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('membership_id');
            $table->string('module', 32);
            $table->foreignUuid('external_identity_id')->constrained('external_identities');
            $table->string('external_team_id', 64)->collation('utf8mb4_bin');
            $table->string('status', 20);
            // Encrypted by the model cast; populated by the gateway in M3. Never passwords.
            $table->text('access_token')->nullable();
            $table->text('refresh_token')->nullable();
            $table->timestamp('token_expires_at')->nullable();
            $table->timestamp('linked_at')->nullable();
            $table->timestamp('last_verified_at')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'membership_id', 'module']);
            $table->foreign('tenant_id')->references('id')->on('tenants');
            // The membership must belong to the SAME tenant.
            $table->foreign(['tenant_id', 'membership_id'])
                ->references(['tenant_id', 'id'])->on('memberships')->cascadeOnDelete();
            // The module must be provisioned for the SAME tenant AND the link's team must be the
            // organization's mapped team: an organization cannot use another organization's team.
            $table->foreign(['tenant_id', 'module', 'external_team_id'])
                ->references(['tenant_id', 'module', 'external_team_id'])->on('tenant_modules');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('module_links');
        Schema::dropIfExists('external_identities');
        Schema::dropIfExists('tenant_modules');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Personal data is held per organization (tenant-owned), never on the login identity.
        // Date of birth is deliberately NOT collected (data minimization; no Tala need).
        Schema::create('crew_profiles', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('membership_id');
            $table->string('first_name', 100);
            $table->string('middle_name', 100)->nullable();
            $table->string('last_name', 100);
            $table->string('suffix', 20)->nullable();
            $table->string('mobile', 20)->nullable();
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants');
            $table->foreign(['tenant_id', 'membership_id'])
                ->references(['tenant_id', 'id'])->on('memberships')->cascadeOnDelete();
            $table->unique(['tenant_id', 'membership_id']);
            $table->unique(['tenant_id', 'id']);
        });

        // Laravel's password broker table (hashed tokens, 60 min expiry in config/auth.php).
        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        // Account-deletion requests (Q-3). Recording only: semantics/retention are an open decision.
        Schema::create('deletion_requests', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('membership_id');
            $table->string('status', 20);
            $table->timestamp('requested_at');
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants');
            $table->foreign(['tenant_id', 'membership_id'])
                ->references(['tenant_id', 'id'])->on('memberships')->cascadeOnDelete();
            // one request per membership until processing semantics (Q-3) define history
            $table->unique(['tenant_id', 'membership_id']);
            $table->index(['tenant_id', 'status', 'requested_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('deletion_requests');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('crew_profiles');
    }
};

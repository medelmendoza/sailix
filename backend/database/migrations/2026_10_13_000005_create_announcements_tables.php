<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Sailix's own announcements (docs/12 D2): written by the organization's administrators, read by every active
        // member of that organization. Audience targeting (G-03) and attachments (needs a file-storage decision) come later.
        Schema::create('announcements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('created_by_membership_id')->nullable();
            $table->string('title', 150);
            $table->text('body');
            $table->boolean('is_active')->default(true);
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants');
            $table->unique(['tenant_id', 'id']);
            $table->index(['tenant_id', 'is_active', 'created_at']);
        });

        Schema::create('announcement_reads', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('announcement_id');
            $table->uuid('membership_id');
            $table->timestamp('read_at');
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants');
            $table->foreign(['tenant_id', 'announcement_id'])
                ->references(['tenant_id', 'id'])->on('announcements')->cascadeOnDelete();
            $table->foreign(['tenant_id', 'membership_id'])
                ->references(['tenant_id', 'id'])->on('memberships')->cascadeOnDelete();
            $table->unique(['announcement_id', 'membership_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('announcement_reads');
        Schema::dropIfExists('announcements');
    }
};

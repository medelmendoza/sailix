<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Who an announcement is for (everyone, or only the listed fleets) and an optional attached file.
 * No fleet rows = everyone, which is how every announcement written so far behaves.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('announcement_fleets', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('announcement_id');
            $table->string('fleet', 100);
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants');
            $table->foreign(['tenant_id', 'announcement_id'])
                ->references(['tenant_id', 'id'])->on('announcements')->cascadeOnDelete();
            $table->unique(['announcement_id', 'fleet']);
            $table->index(['tenant_id', 'fleet']);
        });

        Schema::table('announcements', function (Blueprint $table) {
            // The stored file. Names and types come from the server, never from the client (same rules as documents).
            $table->string('file_disk', 20)->nullable();
            $table->string('file_path', 255)->nullable();
            $table->string('file_original_name', 150)->nullable();
            $table->string('file_mime', 60)->nullable();
            $table->unsignedInteger('file_size')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('announcements', function (Blueprint $table) {
            $table->dropColumn(['file_disk', 'file_path', 'file_original_name', 'file_mime', 'file_size']);
        });
        Schema::dropIfExists('announcement_fleets');
    }
};

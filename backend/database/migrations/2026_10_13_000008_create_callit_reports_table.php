<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Call-it: a crew member's safety observation / incident report (the old app's mock screen, made real).
        Schema::create('callit_reports', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('membership_id'); // the reporter
            $table->string('classification', 30)->nullable();
            $table->string('sub_classification', 30)->nullable();
            $table->string('location', 30)->nullable();
            $table->string('location_other', 120)->nullable();
            $table->string('vessel', 120)->nullable();
            $table->text('details')->nullable();
            $table->boolean('intervened')->default(false);
            $table->text('intervention_details')->nullable();
            $table->boolean('official_report')->default(false); // "does this need official reporting?"
            $table->string('status', 12)->default('draft'); // draft -> submitted -> reviewed
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->uuid('reviewed_by_membership_id')->nullable();
            $table->string('file_disk', 20)->nullable();
            $table->string('file_path', 255)->nullable();
            $table->string('file_original_name', 150)->nullable();
            $table->string('file_mime', 60)->nullable();
            $table->unsignedInteger('file_size')->nullable();
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants');
            $table->foreign(['tenant_id', 'membership_id'])
                ->references(['tenant_id', 'id'])->on('memberships')->cascadeOnDelete();
            $table->index(['tenant_id', 'membership_id', 'status']);
            $table->index(['tenant_id', 'status', 'submitted_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('callit_reports');
    }
};

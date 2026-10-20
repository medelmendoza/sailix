<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** A document an administrator asked one crew member to submit or renew. Closed (fulfilled) when they submit it. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_assignments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('membership_id'); // who is asked
            $table->uuid('document_type_id');
            $table->uuid('requested_by_membership_id')->nullable();
            $table->timestamp('fulfilled_at')->nullable();
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants');
            $table->foreign(['tenant_id', 'membership_id'])
                ->references(['tenant_id', 'id'])->on('memberships')->cascadeOnDelete();
            $table->foreign(['tenant_id', 'document_type_id'])
                ->references(['tenant_id', 'id'])->on('document_types');
            $table->unique(['tenant_id', 'membership_id', 'document_type_id'], 'document_assignments_unique');
            $table->index(['tenant_id', 'membership_id', 'fulfilled_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_assignments');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** The crew record an organization keeps about each member: crew number, rank, fleet, vessel, employment and dates. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('crew_profiles', function (Blueprint $table) {
            $table->string('crew_number', 30)->nullable()->after('suffix');
            $table->string('rank', 60)->nullable()->after('crew_number');
            $table->string('fleet', 100)->nullable()->after('rank');
            $table->string('vessel', 100)->nullable()->after('fleet');
            $table->string('employment_status', 60)->nullable()->after('vessel');
            $table->date('date_arrive')->nullable()->after('employment_status');
            $table->date('date_depart')->nullable()->after('date_arrive');
            $table->date('birthday')->nullable()->after('date_depart');

            $table->unique(['tenant_id', 'crew_number']); // a crew number identifies one person per organization
            $table->index(['tenant_id', 'last_name', 'first_name']);
        });
    }

    public function down(): void
    {
        Schema::table('crew_profiles', function (Blueprint $table) {
            $table->dropUnique(['tenant_id', 'crew_number']);
            $table->dropIndex(['tenant_id', 'last_name', 'first_name']);
            $table->dropColumn(['crew_number', 'rank', 'fleet', 'vessel', 'employment_status', 'date_arrive', 'date_depart', 'birthday']);
        });
    }
};

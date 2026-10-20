<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Core features are ON for every organization; the platform lists the ones it switched OFF.
        Schema::table('tenants', function (Blueprint $table) {
            $table->json('disabled_features')->nullable()->after('slug');
        });
    }

    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn('disabled_features');
        });
    }
};

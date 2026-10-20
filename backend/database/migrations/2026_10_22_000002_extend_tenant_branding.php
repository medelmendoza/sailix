<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenant_branding', function (Blueprint $table) {
            $table->string('short_name', 40)->nullable()->after('tenant_id');
            $table->string('login_welcome_message', 200)->nullable()->after('tagline');
            $table->char('accent_color', 7)->nullable()->after('secondary_color');
            $table->char('background_color', 7)->nullable()->after('accent_color');
            $table->char('text_color', 7)->nullable()->after('background_color');
            $table->string('font_preset', 16)->nullable()->after('text_color');
            $table->string('login_logo_path', 255)->nullable()->after('favicon_mime');
            $table->string('login_logo_mime', 40)->nullable()->after('login_logo_path');
            $table->string('login_background_path', 255)->nullable()->after('login_logo_mime');
            $table->string('login_background_mime', 40)->nullable()->after('login_background_path');
        });
    }

    public function down(): void
    {
        Schema::table('tenant_branding', function (Blueprint $table) {
            $table->dropColumn([
                'short_name', 'login_welcome_message', 'accent_color', 'background_color', 'text_color', 'font_preset',
                'login_logo_path', 'login_logo_mime', 'login_background_path', 'login_background_mime',
            ]);
        });
    }
};

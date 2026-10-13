<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Documents (docs/12 D3). The old Sailix keyed everything by `crewID`; here the owner is a membership.
        Schema::create('document_types', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->string('name', 120);
            $table->string('short_name', 40)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants');
            $table->unique(['tenant_id', 'id']);
            $table->unique(['tenant_id', 'name']);
        });

        Schema::create('crew_documents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('membership_id'); // the owner
            $table->uuid('document_type_id');
            $table->string('number', 80)->nullable();
            $table->string('grade', 80)->nullable();
            $table->string('location', 120)->nullable(); // place of issue
            $table->string('school', 120)->nullable();
            $table->date('issued_on')->nullable();
            $table->date('expires_on')->nullable();
            // pending (waiting for the agency) -> approved | rejected (with a reason; the owner may resubmit)
            $table->string('status', 10)->default('pending');
            $table->string('rejection_reason', 500)->nullable();
            $table->uuid('reviewed_by_membership_id')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            // The stored file. Names and types come from the server, never from the client.
            $table->string('file_disk', 20);
            $table->string('file_path', 255);
            $table->string('file_original_name', 150);
            $table->string('file_mime', 60);
            $table->unsignedInteger('file_size');
            $table->timestamp('submitted_at');
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants');
            $table->foreign(['tenant_id', 'membership_id'])
                ->references(['tenant_id', 'id'])->on('memberships')->cascadeOnDelete();
            $table->foreign(['tenant_id', 'document_type_id'])
                ->references(['tenant_id', 'id'])->on('document_types');
            $table->index(['tenant_id', 'membership_id', 'status']);
            $table->index(['tenant_id', 'status', 'submitted_at']);
        });

        // Finance (docs/12 D5). Money columns are the SERVER's values (spec BR-48): the apps never recompute them.
        Schema::create('payslips', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('membership_id');
            $table->string('kind', 10); // regular | special | final
            $table->date('pay_date'); // the old `date_pro`
            $table->string('period_label', 60); // `dateProName`, or "Final Pay"
            $table->string('vessel_name', 120);
            $table->string('full_vessel_name', 160)->nullable();
            $table->string('position', 120)->nullable(); // `long_posname`
            $table->string('address', 255)->nullable();
            $table->date('depart_date')->nullable();
            $table->date('payroll_date')->nullable();
            $table->string('payee_name', 160)->nullable();
            $table->string('bank_code', 20)->nullable();
            $table->text('account_number')->nullable(); // encrypted at rest, masked in every response
            $table->boolean('is_dollar')->default(false);
            $table->decimal('exchange_rate', 12, 4)->nullable();
            $table->decimal('pay_usd', 14, 2)->nullable();
            $table->decimal('pay_peso', 14, 2)->nullable();
            $table->decimal('adjustment', 14, 2)->nullable();
            $table->string('adjustment_detail', 255)->nullable();
            $table->decimal('signon_adjustment', 14, 2)->nullable();
            $table->decimal('union_dues', 14, 2)->nullable();
            $table->decimal('bank_charges', 14, 2)->nullable();
            $table->decimal('withholding_tax', 14, 2)->nullable();
            $table->decimal('mpfee', 14, 2)->nullable();
            $table->decimal('sss_total', 14, 2)->nullable();
            $table->decimal('employee_sss', 14, 2)->nullable();
            $table->decimal('employee_philhealth', 14, 2)->nullable();
            $table->decimal('employee_pagibig', 14, 2)->nullable();
            $table->decimal('deductions_total', 14, 2)->nullable();
            $table->decimal('net_amount', 14, 2);
            $table->boolean('is_hold')->default(false); // a held payslip is not shown to the member
            $table->string('allotment_type', 40)->nullable();
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants');
            $table->unique(['tenant_id', 'id']);
            $table->foreign(['tenant_id', 'membership_id'])
                ->references(['tenant_id', 'id'])->on('memberships')->cascadeOnDelete();
            $table->index(['tenant_id', 'membership_id', 'kind', 'pay_date']);
        });

        Schema::create('payslip_deductions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('payslip_id');
            $table->string('description', 150);
            $table->decimal('amount', 14, 2);
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants');
            $table->foreign(['tenant_id', 'payslip_id'])
                ->references(['tenant_id', 'id'])->on('payslips')->cascadeOnDelete();
        });

        Schema::create('loans', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('tenant_id');
            $table->uuid('membership_id');
            $table->string('code', 30);
            $table->string('description', 150);
            $table->date('loan_date')->nullable();
            $table->date('start_of_deduction')->nullable();
            $table->decimal('loan_amount', 14, 2);
            $table->decimal('deduct_amount', 14, 2)->default(0);
            $table->decimal('paid_amount', 14, 2)->default(0);
            $table->decimal('balance', 14, 2)->default(0);
            $table->boolean('is_dollar')->default(false);
            $table->boolean('is_stopped')->default(false);
            $table->boolean('is_scholar')->default(false);
            $table->boolean('is_cadet')->default(false);
            $table->boolean('is_inactive')->default(false);
            $table->string('remarks', 255)->nullable();
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants');
            $table->foreign(['tenant_id', 'membership_id'])
                ->references(['tenant_id', 'id'])->on('memberships')->cascadeOnDelete();
            $table->index(['tenant_id', 'membership_id', 'is_inactive']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loans');
        Schema::dropIfExists('payslip_deductions');
        Schema::dropIfExists('payslips');
        Schema::dropIfExists('crew_documents');
        Schema::dropIfExists('document_types');
    }
};

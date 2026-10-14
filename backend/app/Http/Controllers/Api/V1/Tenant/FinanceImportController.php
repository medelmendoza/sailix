<?php

namespace App\Http\Controllers\Api\V1\Tenant;

use App\Finance\CsvImport;
use App\Finance\LoanImport;
use App\Finance\PayslipImport;
use App\Http\Controllers\Controller;
use App\Support\ApiProblem;
use App\Support\Audit;
use App\Support\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\Response;

/**
 * An administrator loads their payroll system's payslips and cash advances for their OWN organization's members. The file is
 * checked whole before anything is written (`commit` false just reports), and the audit trail records counts, never contents.
 */
class FinanceImportController extends Controller
{
    public function template(string $kind): Response
    {
        Gate::authorize('finance.manage');

        return response($this->importer($kind)->template(), 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$kind}-template.csv\"",
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function import(Request $request, string $kind, TenantContext $context): JsonResponse
    {
        Gate::authorize('finance.manage');
        $request->validate([
            'file' => ['required', 'file', 'max:'.(CsvImport::MAX_BYTES / 1024), 'extensions:csv,txt'],
            'commit' => ['sometimes', 'boolean'],
        ]);

        $commit = $request->boolean('commit');
        $result = $this->importer($kind)->run($request->file('file'), $commit);
        if ($result['imported']) {
            Audit::record('finance.imported', $context->tenantId(), null, ['kind' => $kind, 'rows' => $result['rows'], 'created' => $result['created'], 'updated' => $result['updated']]);
        }

        return response()->json(['data' => $result]);
    }

    private function importer(string $kind): CsvImport
    {
        return match ($kind) {
            'payslips' => new PayslipImport,
            'loans' => new LoanImport,
            default => throw ApiProblem::notFound('Unknown import.'),
        };
    }
}

<?php

namespace App\Models;

use App\Support\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * @property string $id
 * @property string $payslip_id
 * @property string $description
 * @property string $amount
 * @property int $position
 */
class PayslipDeduction extends Model
{
    use BelongsToTenant, HasUuids;

    protected $guarded = ['*'];
}

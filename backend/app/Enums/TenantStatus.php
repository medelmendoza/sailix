<?php

namespace App\Enums;

enum TenantStatus: string
{
    case Provisioning = 'provisioning';
    case Active = 'active';
    case Suspended = 'suspended';
    case Deactivated = 'deactivated';
    case Archived = 'archived';
}

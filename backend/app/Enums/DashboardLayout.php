<?php

namespace App\Enums;

/** How roomy the admin portal is. Empty means comfortable. */
enum DashboardLayout: string
{
    case Comfortable = 'comfortable';
    case Compact = 'compact';
}

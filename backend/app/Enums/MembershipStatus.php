<?php

namespace App\Enums;

enum MembershipStatus: string
{
    case Invited = 'invited';
    case Pending = 'pending';
    case Active = 'active';
    case Suspended = 'suspended';
}

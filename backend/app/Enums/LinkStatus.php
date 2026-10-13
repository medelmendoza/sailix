<?php

namespace App\Enums;

enum LinkStatus: string
{
    case Linked = 'linked';
    case NeedsRelink = 'needs_relink';
    case Revoked = 'revoked';
}

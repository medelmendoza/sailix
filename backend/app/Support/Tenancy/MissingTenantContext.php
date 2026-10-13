<?php

namespace App\Support\Tenancy;

use LogicException;

/** Thrown instead of returning unscoped data when tenant code runs without a context (fail closed). */
class MissingTenantContext extends LogicException {}

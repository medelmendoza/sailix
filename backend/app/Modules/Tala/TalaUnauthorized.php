<?php

namespace App\Modules\Tala;

use RuntimeException;

/** Tala rejected the stored token (401/403) on an authenticated call: the link needs to be re-established. */
final class TalaUnauthorized extends RuntimeException {}

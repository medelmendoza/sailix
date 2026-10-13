<?php

namespace App\Modules\Tala;

use RuntimeException;

/** Tala answered the login with a client error (wrong or unusable credentials). */
final class TalaLoginRejected extends RuntimeException {}

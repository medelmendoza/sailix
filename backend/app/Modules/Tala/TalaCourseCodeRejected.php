<?php

namespace App\Modules\Tala;

use RuntimeException;

/** Tala answered the course application with a client error (unknown, expired or unusable course code). */
final class TalaCourseCodeRejected extends RuntimeException {}

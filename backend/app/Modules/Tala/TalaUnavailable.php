<?php

namespace App\Modules\Tala;

use RuntimeException;

/** Tala could not be used right now (not configured, unsafe endpoint, network, timeout, 5xx, redirect, bad payload). Never carries upstream bodies. */
final class TalaUnavailable extends RuntimeException {}

<?php
/**
 * Loaded at the top of every PHP entrypoint.
 * - Loads config
 * - Configures error reporting & timezone
 * - Starts the session
 * - Provides $config, $pdo (lazy via db())
 */

declare(strict_types=1);

if (defined('PAARAMI_BOOTSTRAPPED')) {
    return;
}
define('PAARAMI_BOOTSTRAPPED', true);

$configPath = dirname(__DIR__) . '/config.php';
if (!file_exists($configPath)) {
    http_response_code(500);
    exit('config.php missing — copy config.sample.php to config.php and fill values.');
}

/** @var array $config */
$config = require $configPath;
$GLOBALS['paarami_config'] = $config;

date_default_timezone_set($config['app']['timezone'] ?? 'UTC');

if (!empty($config['app']['debug'])) {
    error_reporting(E_ALL);
    ini_set('display_errors', '1');
} else {
    error_reporting(E_ALL);
    ini_set('display_errors', '0');
    ini_set('log_errors', '1');
}

// Session cookie params
$sess = $config['session'];
session_name($sess['name']);
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'secure'   => (bool)$sess['secure'],
    'httponly' => true,
    'samesite' => $sess['samesite'] ?? 'Lax',
]);
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Idle timeout
if (!empty($_SESSION['user']) && !empty($_SESSION['_last_activity'])) {
    if (time() - (int)$_SESSION['_last_activity'] > (int)$sess['lifetime']) {
        $_SESSION = [];
        session_destroy();
    }
}
$_SESSION['_last_activity'] = time();

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/csrf.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/encryption.php';
require_once __DIR__ . '/activity_log.php';
require_once __DIR__ . '/page_header.php';

/* -------- Security headers (internal portal — no crawlers) -------- */
if (PHP_SAPI !== 'cli') {
    $sec = $config['security'] ?? [];
    if (!empty($sec['strict_headers'])) {
        header('X-Frame-Options: SAMEORIGIN');
        header('X-Content-Type-Options: nosniff');
        header('Referrer-Policy: strict-origin-when-cross-origin');
        header('Permissions-Policy: geolocation=(), microphone=(), camera=()');
        header("Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self'; frame-ancestors 'self'");
    }
    if (!empty($sec['block_crawlers'])) {
        header('X-Robots-Tag: noindex, nofollow, noarchive, nosnippet');
    }
}
<?php
/**
 * Copy this file to config.php and fill in real values.
 * config.php is loaded by includes/bootstrap.php and MUST NOT be committed.
 */

return [
    // ---- Database (MySQL 8) ----
    'db' => [
        'host'    => 'localhost',
        'port'    => 3306,
        'name'    => 'paarami_portal',
        'user'    => 'paarami',
        'pass'    => 'change-me',
        'charset' => 'utf8mb4',
    ],

    // ---- App ----
    'app' => [
        'name'      => 'Internal Operations Portal',
        'base_url'  => 'https://portal.paaramidigital.com',  // no trailing slash
        'timezone'  => 'Asia/Kolkata',
        'debug'     => false,
    ],

    // ---- Credentials Vault encryption ----
    // Generate ONCE: php -r "echo bin2hex(random_bytes(32));"
    // Keep this key constant forever; rotating it makes existing
    // encrypted credentials unrecoverable.
    'vault' => [
        'key_hex' => 'REPLACE_WITH_64_HEX_CHARS_FROM_random_bytes_32',
        'cipher'  => 'aes-256-gcm',
    ],

    // ---- SMTP (overridden by Settings -> SMTP if set) ----
    'smtp' => [
        'host'       => 'smtp.hostinger.com',
        'port'       => 465,
        'encryption' => 'ssl',         // ssl | tls | ''
        'username'   => 'notify@paaramidigital.com',
        'password'   => 'change-me',
        'from_email' => 'notify@paaramidigital.com',
        'from_name'  => 'Paarami Digital',
    ],

    // ---- Session ----
    'session' => [
        'name'     => 'paarami_sid',
        'lifetime' => 60 * 60 * 8,     // 8 hours
        'secure'   => true,            // set false on local http
        'samesite' => 'Lax',
    ],
];
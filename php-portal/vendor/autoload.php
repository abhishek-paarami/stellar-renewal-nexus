<?php
/**
 * Minimal PSR-4 autoloader for the bundled vendor libraries.
 * No composer required — keeps the ZIP portable for Hostinger.
 */
spl_autoload_register(function (string $class): void {
    $prefixes = [
        'PHPMailer\\PHPMailer\\' => __DIR__ . '/PHPMailer/src/',
    ];
    foreach ($prefixes as $prefix => $baseDir) {
        if (strncmp($prefix, $class, strlen($prefix)) !== 0) continue;
        $rel = substr($class, strlen($prefix));
        $file = $baseDir . str_replace('\\', '/', $rel) . '.php';
        if (is_file($file)) { require $file; return; }
    }
});
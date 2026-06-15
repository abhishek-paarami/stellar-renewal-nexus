<?php
declare(strict_types=1);

function e(?string $s): string { return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }

function url(string $path = ''): string {
    $base = rtrim($GLOBALS['paarami_config']['app']['base_url'] ?? '', '/');
    return $base . '/' . ltrim($path, '/');
}

function redirect(string $path): void {
    header('Location: ' . (str_starts_with($path, 'http') ? $path : url($path)));
    exit;
}

function flash(string $key, ?string $value = null): ?string {
    if ($value !== null) { $_SESSION['_flash'][$key] = $value; return null; }
    if (!isset($_SESSION['_flash'][$key])) return null;
    $v = $_SESSION['_flash'][$key];
    unset($_SESSION['_flash'][$key]);
    return $v;
}

function client_ip(): ?string {
    return $_SERVER['HTTP_X_FORWARDED_FOR']
        ?? $_SERVER['HTTP_X_REAL_IP']
        ?? $_SERVER['REMOTE_ADDR']
        ?? null;
}

function format_date(?string $iso, string $fmt = 'd M Y'): string {
    if (!$iso) return '—';
    try { return (new DateTime($iso))->format($fmt); } catch (Throwable) { return $iso; }
}

function days_until(?string $iso): ?int {
    if (!$iso) return null;
    try {
        $now = new DateTime('today');
        $exp = new DateTime($iso);
        return (int)$now->diff($exp)->format('%r%a');
    } catch (Throwable) { return null; }
}

function input(string $key, mixed $default = null): mixed {
    return $_POST[$key] ?? $_GET[$key] ?? $default;
}

function json_response(mixed $data, int $code = 200): never {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
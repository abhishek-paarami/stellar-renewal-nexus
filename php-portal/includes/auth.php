<?php
declare(strict_types=1);

function current_user(): ?array {
    if (empty($_SESSION['user_id'])) return null;
    static $cached = null;
    if ($cached && $cached['id'] === $_SESSION['user_id']) return $cached;
    $u = db_one(
        'SELECT id, full_name, email, role, custom_role_id, is_active, last_login
         FROM user_profiles WHERE id = ? LIMIT 1',
        [$_SESSION['user_id']]
    );
    if (!$u || !$u['is_active']) {
        $_SESSION = []; session_destroy();
        return null;
    }
    $cached = $u;
    return $u;
}

function require_login(): array {
    $u = current_user();
    if (!$u) redirect('/login.php');
    return $u;
}

function require_super_admin(): array {
    $u = require_login();
    if ($u['role'] !== 'super_admin') {
        http_response_code(403);
        exit('Forbidden — Super Admin only.');
    }
    return $u;
}

function is_super_admin(): bool {
    $u = current_user();
    return $u && $u['role'] === 'super_admin';
}

function attempt_login(string $email, string $password): array {
    $u = db_one(
        'SELECT id, full_name, email, password_hash, role, is_active
         FROM user_profiles WHERE email = ? LIMIT 1',
        [strtolower(trim($email))]
    );
    if (!$u) return ['ok' => false, 'error' => 'Invalid email or password.'];
    if (!$u['is_active']) return ['ok' => false, 'error' => 'Your account has been disabled. Contact your Super Admin.'];
    if (!password_verify($password, $u['password_hash'])) {
        return ['ok' => false, 'error' => 'Invalid email or password.'];
    }
    // Rotate session ID after auth
    session_regenerate_id(true);
    $_SESSION['user_id'] = $u['id'];
    db_exec('UPDATE user_profiles SET last_login = CURRENT_TIMESTAMP(6) WHERE id = ?', [$u['id']]);
    return ['ok' => true, 'user' => $u];
}

function logout(): void {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
}
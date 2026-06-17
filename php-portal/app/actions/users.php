<?php
require __DIR__ . '/../../../includes/bootstrap.php';
$me = require_super_admin();
verify_csrf();
header('Content-Type: application/json; charset=utf-8');

try {
    $action = (string)($_POST['action'] ?? '');

    if ($action === 'create') {
        $name = trim((string)($_POST['full_name'] ?? ''));
        $email = strtolower(trim((string)($_POST['email'] ?? '')));
        $pw   = (string)($_POST['password'] ?? '');
        $role = (string)($_POST['role'] ?? 'manager');
        if ($name === '' || $email === '' || strlen($pw) < 8) throw new RuntimeException('All fields required (password min 8 chars).');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) throw new RuntimeException('Invalid email.');
        if (db_one('SELECT id FROM user_profiles WHERE email = ?', [$email])) throw new RuntimeException('A user with this email already exists.');
        $custom = null; $base = 'manager';
        if (str_starts_with($role, 'custom:')) { $custom = substr($role, 7); }
        elseif ($role === 'super_admin')      { $base = 'super_admin'; }
        $id = uuidv4();
        db_exec('INSERT INTO user_profiles (id, full_name, email, password_hash, role, custom_role_id, is_active) VALUES (?,?,?,?,?,?,1)',
            [$id, $name, $email, password_hash($pw, PASSWORD_BCRYPT), $base, $custom]);
        log_activity('user_invite', ['entity_type'=>'user','entity_id'=>$id,'description'=>"Invited $email"]);
        json_response(['ok'=>true,'id'=>$id,'message'=>'User created']);
    }

    if ($action === 'update') {
        $id = (string)($_POST['id'] ?? '');
        $row = db_one('SELECT * FROM user_profiles WHERE id = ?', [$id]);
        if (!$row) throw new RuntimeException('User not found.');
        $name = trim((string)($_POST['full_name'] ?? ''));
        if ($name === '') throw new RuntimeException('Full name is required.');
        $isSelf = $id === $me['id'];
        if ($isSelf) {
            db_exec('UPDATE user_profiles SET full_name=? WHERE id=?', [$name, $id]);
        } else {
            $role   = (string)($_POST['role'] ?? 'manager');
            $active = !empty($_POST['is_active']) ? 1 : 0;
            $custom = null; $base = 'manager';
            if (str_starts_with($role, 'custom:')) { $custom = substr($role, 7); }
            elseif ($role === 'super_admin')      { $base = 'super_admin'; }
            db_exec('UPDATE user_profiles SET full_name=?, role=?, custom_role_id=?, is_active=? WHERE id=?',
                [$name, $base, $custom, $active, $id]);
        }
        log_activity('update', ['entity_type'=>'user','entity_id'=>$id,'description'=>"Updated user {$row['email']}"]);
        json_response(['ok'=>true]);
    }

    if ($action === 'reset_password') {
        $id = (string)($_POST['id'] ?? '');
        $pw = (string)($_POST['password'] ?? '');
        if (strlen($pw) < 8) throw new RuntimeException('Password must be at least 8 characters.');
        $u = db_one('SELECT email FROM user_profiles WHERE id = ?', [$id]);
        if (!$u) throw new RuntimeException('User not found.');
        db_exec('UPDATE user_profiles SET password_hash=? WHERE id=?', [password_hash($pw, PASSWORD_BCRYPT), $id]);
        log_activity('user_reset_password', ['entity_type'=>'user','entity_id'=>$id,'description'=>"Reset password for {$u['email']}"]);
        json_response(['ok'=>true]);
    }

    if ($action === 'delete') {
        $id = (string)($_POST['id'] ?? '');
        if ($id === $me['id']) throw new RuntimeException('You cannot delete yourself.');
        $u = db_one('SELECT email FROM user_profiles WHERE id = ?', [$id]);
        if (!$u) throw new RuntimeException('User not found.');
        db_exec('DELETE FROM user_profiles WHERE id = ?', [$id]);
        log_activity('user_delete', ['entity_type'=>'user','entity_id'=>$id,'description'=>"Deleted user {$u['email']}"]);
        json_response(['ok'=>true]);
    }

    if ($action === 'add_role') {
        $label = trim((string)($_POST['label'] ?? ''));
        if ($label === '') throw new RuntimeException('Label required.');
        $name  = strtolower(preg_replace('/[^a-z0-9]+/i', '_', $label));
        if (db_one('SELECT id FROM custom_roles WHERE name = ?', [$name])) throw new RuntimeException('Role with similar name already exists.');
        $id = uuidv4();
        db_exec('INSERT INTO custom_roles (id, name, label, created_by) VALUES (?,?,?,?)', [$id, $name, $label, $me['id']]);
        json_response(['ok'=>true,'id'=>$id]);
    }

    if ($action === 'delete_role') {
        $id = (string)($_POST['id'] ?? '');
        $row = db_one('SELECT COUNT(*) AS c FROM user_profiles WHERE custom_role_id = ?', [$id]);
        if ($row && (int)$row['c'] > 0) throw new RuntimeException('Cannot delete: this role has users assigned. Reassign them first.');
        db_exec('DELETE FROM custom_roles WHERE id = ?', [$id]);
        json_response(['ok'=>true]);
    }

    json_response(['ok'=>false,'error'=>'Unknown action.'], 400);
} catch (Throwable $e) {
    json_response(['ok'=>false,'error'=>$e->getMessage()], 400);
}
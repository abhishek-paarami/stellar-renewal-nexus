<?php
require __DIR__ . '/../../includes/bootstrap.php';
$me = require_super_admin();

/* Tables backed up — order matters for restore (parents first). */
const BK_TABLES = [
    'user_profiles','custom_roles','custom_role_members','developers','bd_persons',
    'clients','renewals','amc_clients','time_entries',
    'email_templates','email_logs','reminder_logs','activity_logs','credential_access_logs','app_settings',
];

/* Binary columns -> base64 in JSON */
const BK_BINARY = [
    'renewals' => ['username_enc','password_enc','ftp_username_enc','ftp_password_enc','extra_creds_enc'],
];

$action = $_GET['action'] ?? $_POST['action'] ?? '';

if ($action === 'export') {
    /* CSRF check via session - GET allowed for download convenience but require valid session */
    $out = ['version'=>1,'exported_at'=>gmdate('c'),'tables'=>[]];
    foreach (BK_TABLES as $t) {
        $rows = db_all("SELECT * FROM `$t`");
        if (isset(BK_BINARY[$t])) {
            foreach ($rows as &$r) {
                foreach (BK_BINARY[$t] as $col) {
                    if (isset($r[$col]) && $r[$col] !== null && $r[$col] !== '') {
                        $r[$col] = '__b64__:' . base64_encode($r[$col]);
                    }
                }
            }
        }
        $out['tables'][$t] = $rows;
    }
    $stamp = gmdate('Ymd-His');
    header('Content-Type: application/json; charset=utf-8');
    header('Content-Disposition: attachment; filename="paarami-backup-' . $stamp . '.json"');
    log_activity('export', ['entity_type'=>'import_export','description'=>'Downloaded full DB backup']);
    echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

verify_csrf();
header('Content-Type: application/json; charset=utf-8');

try {
    if ($action !== 'import') json_response(['ok'=>false,'error'=>'Unknown action.'], 400);
    $mode = ($_POST['mode'] ?? 'replace') === 'merge' ? 'merge' : 'replace';
    $raw  = (string)($_POST['data'] ?? '');
    $data = json_decode($raw, true);
    if (!is_array($data) || !isset($data['tables'])) throw new RuntimeException('Invalid backup payload.');
    $tables = $data['tables'];
    $report = [];

    db()->beginTransaction();
    db()->exec('SET FOREIGN_KEY_CHECKS = 0');

    /* Replace mode: wipe tables (skip user_profiles + app_settings to keep the admin alive). */
    if ($mode === 'replace') {
        foreach (array_reverse(BK_TABLES) as $t) {
            if ($t === 'user_profiles' || $t === 'app_settings') continue;
            $n = db_exec("DELETE FROM `$t`");
            $report[$t]['deleted'] = $n;
        }
    }

    foreach (BK_TABLES as $t) {
        if (!isset($tables[$t]) || !is_array($tables[$t])) continue;
        $rows = $tables[$t];
        if (!$rows) { $report[$t]['inserted'] = 0; continue; }
        try {
            $cols = array_keys($rows[0]);
            $place = '(' . implode(',', array_fill(0, count($cols), '?')) . ')';
            $colSql = '`' . implode('`,`', $cols) . '`';
            $update = implode(',', array_map(fn($c) => "`$c` = VALUES(`$c`)", $cols));
            $sql = "INSERT INTO `$t` ($colSql) VALUES $place ON DUPLICATE KEY UPDATE $update";
            $stmt = db()->prepare($sql);
            $inserted = 0;
            foreach ($rows as $r) {
                $vals = [];
                foreach ($cols as $c) {
                    $v = $r[$c] ?? null;
                    if (is_array($v)) $v = json_encode($v, JSON_UNESCAPED_UNICODE);
                    elseif (is_string($v) && str_starts_with($v, '__b64__:')) $v = base64_decode(substr($v, 8));
                    $vals[] = $v;
                }
                $stmt->execute($vals);
                $inserted++;
            }
            $report[$t]['inserted'] = $inserted;
        } catch (Throwable $e) {
            $report[$t]['error'] = substr($e->getMessage(), 0, 200);
        }
    }

    db()->exec('SET FOREIGN_KEY_CHECKS = 1');
    db()->commit();

    log_activity('import', ['entity_type'=>'import_export','description'=>"Restored full DB backup ($mode)"]);
    json_response(['ok'=>true,'report'=>$report]);
} catch (Throwable $e) {
    if (db()->inTransaction()) db()->rollBack();
    db()->exec('SET FOREIGN_KEY_CHECKS = 1');
    json_response(['ok'=>false,'error'=>$e->getMessage()], 400);
}
<?php
require __DIR__ . '/../../../includes/bootstrap.php';
require_once __DIR__ . '/../../../includes/reminders.php';
$user = require_super_admin();

$method = $_SERVER['REQUEST_METHOD'];
$action = (string)($_POST['action'] ?? $_GET['action'] ?? '');

// CSV download (GET) - no CSRF, but super-admin only.
if ($action === 'export_log') {
    $type = (string)($_GET['type'] ?? '');
    $from = (string)($_GET['from'] ?? '1970-01-01');
    $to   = (string)($_GET['to']   ?? '2999-01-01');
    $map = ['email-log'=>['email_logs','sent_at',['sent_at','email_type','to_addresses','cc_addresses','subject','status','error_message']],
            'logs'=>['reminder_logs','sent_at',['sent_at','reminder_type','expiry_kind','sent_to','status','error_message']],
            'activity'=>['activity_logs','created_at',['created_at','user_id','action_type','entity_type','description']]];
    if (!isset($map[$type])) { http_response_code(400); exit('Invalid type'); }
    [$tbl,$col,$cols] = $map[$type];
    $rows = db_all("SELECT * FROM $tbl WHERE $col BETWEEN ? AND ? ORDER BY $col DESC LIMIT 5000", [$from,$to]);
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $type . '-' . date('Y-m-d') . '.csv"');
    $out = fopen('php://output', 'w'); fputcsv($out, $cols);
    foreach ($rows as $r) {
        $line = [];
        foreach ($cols as $c) {
            $v = $r[$c] ?? '';
            if (is_string($v) && $v !== '' && $v[0] === '[') {
                $d = json_decode($v, true); if (is_array($d)) $v = implode('; ', $d);
            }
            $line[] = $v;
        }
        fputcsv($out, $line);
    }
    fclose($out); exit;
}

verify_csrf();
header('Content-Type: application/json; charset=utf-8');

try {
    if ($action === 'save_smtp') {
        $value = [
            'host'=>trim((string)($_POST['host'] ?? '')),
            'port'=>(int)($_POST['port'] ?? 587),
            'secure'=>!empty($_POST['secure']),
            'encryption'=>!empty($_POST['secure']) ? 'ssl' : 'tls',
            'username'=>trim((string)($_POST['username'] ?? '')),
            'password'=>(string)($_POST['password'] ?? ''),
            'from_email'=>trim((string)($_POST['from_email'] ?? '')),
            'from_name'=>trim((string)($_POST['from_name'] ?? '')),
            'enabled'=>!empty($_POST['enabled']),
        ];
        upsert_setting('smtp', $value, $user['id']);
        log_activity('update',['entity_type'=>'settings','description'=>'Saved SMTP configuration']);
        json_response(['ok'=>true,'message'=>'SMTP saved']);
    }
    if ($action === 'save_reminders') {
        $days = array_values(array_filter(array_map('intval', preg_split('/[\s,]+/', (string)($_POST['days_before'] ?? ''))), fn($n)=>$n>0));
        $pct  = array_values(array_filter(array_map('intval', preg_split('/[\s,]+/', (string)($_POST['amc_percents'] ?? ''))), fn($n)=>$n>0 && $n<=100));
        $amcD = array_values(array_filter(array_map('intval', preg_split('/[\s,]+/', (string)($_POST['amc_days_before'] ?? ''))), fn($n)=>$n>0));
        if (!$days) throw new RuntimeException('Days Before Expiry must have at least one number');
        if (!$pct)  throw new RuntimeException('AMC % Thresholds must have at least one number 1–100');
        rsort($days); rsort($pct); rsort($amcD);
        $value = [
            'days_before'      => implode(',', $days),
            'renewal_days'     => $days,
            'amc_percents'     => $pct,
            'amc_days_before'  => $amcD,
            'send_after_expiry'=> !empty($_POST['send_after_expiry']),
            'cc_internal'      => trim((string)($_POST['cc_internal'] ?? '')),
        ];
        upsert_setting('reminders', $value, $user['id']);
        auto_seed_templates($days, $pct, $amcD);
        log_activity('update',['entity_type'=>'settings','description'=>'Saved reminder schedule — templates synced']);
        json_response(['ok'=>true,'message'=>'Reminder settings saved — templates synced']);
    }
    if ($action === 'send_test') {
        require_once __DIR__ . '/../../../includes/mailer.php';
        $to = trim((string)($_POST['to'] ?? ''));
        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) throw new RuntimeException('Enter a valid email');
        $res = send_mail([$to], [], 'Paarami Portal SMTP test',
            '<div style="font-family:Inter,Arial,sans-serif;padding:24px"><h2>SMTP test ✔</h2><p>If you can read this, SMTP is working.</p></div>',
            ['type'=>'smtp_test','entity'=>'settings']);
        if (!$res['ok']) throw new RuntimeException($res['error'] ?? 'Send failed');
        json_response(['ok'=>true]);
    }
    if ($action === 'run_reminders') {
        $res = run_reminder_dispatch();
        log_activity('run',['entity_type'=>'reminders','description'=>"Manual reminder run — {$res['sent']} sent"]);
        json_response(['ok'=>true,'sent'=>$res['sent']]);
    }
    json_response(['ok'=>false,'error'=>'Unknown action.'], 400);
} catch (Throwable $e) {
    json_response(['ok'=>false,'error'=>$e->getMessage()], 400);
}

function upsert_setting(string $key, array $value, string $uid): void {
    $row = db_one('SELECT id FROM app_settings WHERE `key` = ?', [$key]);
    if ($row) db_exec('UPDATE app_settings SET value = ?, updated_by = ? WHERE id = ?', [json_col($value), $uid, $row['id']]);
    else      db_exec('INSERT INTO app_settings (id, `key`, value, updated_by) VALUES (?,?,?,?)', [uuidv4(), $key, json_col($value), $uid]);
}
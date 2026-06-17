<?php
require __DIR__ . '/../../../includes/bootstrap.php';
require_once __DIR__ . '/../../../includes/reminders.php';
$user = require_login();
verify_csrf();
header('Content-Type: application/json; charset=utf-8');

/**
 * Recompute consumed_hours from APPROVED entries and persist on amc_clients.
 * Mirrors Lovable's auto-deduct behaviour.
 */
function recompute_amc_hours(string $amcId): float {
    $row = db_one('SELECT COALESCE(SUM(hours + minutes/60),0) h FROM time_entries WHERE amc_client_id = ? AND status = "approved"', [$amcId]);
    $total = round((float)($row['h'] ?? 0), 2);
    db_exec('UPDATE amc_clients SET consumed_hours = ? WHERE id = ?', [$total, $amcId]);
    return $total;
}

try {
    $action = (string)($_POST['action'] ?? '');
    if ($action === 'upsert') {
        $id = trim((string)($_POST['id'] ?? ''));
        $amcId = (string)($_POST['amc_client_id'] ?? '');
        $dev   = trim((string)($_POST['developer_name'] ?? ''));
        $work  = trim((string)($_POST['work_description'] ?? ''));
        if (!$amcId || !$dev || !$work) throw new RuntimeException('AMC, developer & work are required.');
        $payload = [
            'amc_client_id'    => $amcId,
            'developer_name'   => $dev,
            'entry_date'       => $_POST['entry_date'] ?: date('Y-m-d'),
            'work_description' => $work,
            'hours'            => (int)($_POST['hours'] ?? 0),
            'minutes'          => (int)($_POST['minutes'] ?? 0),
            'is_billable'      => (int)!empty($_POST['is_billable']),
            'status'           => in_array($_POST['status'] ?? 'approved', ['pending','approved','rejected'], true) ? $_POST['status'] : 'approved',
        ];
        if ($id === '') {
            $id = uuidv4();
            db_exec('INSERT INTO time_entries (id, amc_client_id, developer_name, entry_date, work_description, hours, minutes, is_billable, status, created_by, updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
                [$id, $payload['amc_client_id'], $payload['developer_name'], $payload['entry_date'], $payload['work_description'], $payload['hours'], $payload['minutes'], $payload['is_billable'], $payload['status'], $user['id'], $user['id']]);
            log_activity('create', ['entity_type'=>'time_entry','entity_id'=>$id,'description'=>"Logged time entry — $dev · {$payload['hours']}h {$payload['minutes']}m"]);
        } else {
            db_exec('UPDATE time_entries SET amc_client_id=?, developer_name=?, entry_date=?, work_description=?, hours=?, minutes=?, is_billable=?, status=?, updated_by=? WHERE id=?',
                [$payload['amc_client_id'], $payload['developer_name'], $payload['entry_date'], $payload['work_description'], $payload['hours'], $payload['minutes'], $payload['is_billable'], $payload['status'], $user['id'], $id]);
            log_activity('update', ['entity_type'=>'time_entry','entity_id'=>$id,'description'=>"Updated time entry — $dev · {$payload['hours']}h {$payload['minutes']}m"]);
        }
        recompute_amc_hours($amcId);
        if ($payload['status'] === 'approved') {
            try { fire_amc_instant_alert($amcId, true); } catch (Throwable) { /* don't block save */ }
        }
        json_response(['ok'=>true,'id'=>$id,'message'=>'Saved']);
    }
    if ($action === 'delete') {
        $id = (string)($_POST['id'] ?? '');
        $row = db_one('SELECT amc_client_id FROM time_entries WHERE id = ?', [$id]);
        if (!$row) throw new RuntimeException('Entry not found.');
        db_exec('DELETE FROM time_entries WHERE id = ?', [$id]);
        recompute_amc_hours($row['amc_client_id']);
        log_activity('delete', ['entity_type'=>'time_entry','entity_id'=>$id,'description'=>'Deleted time entry']);
        json_response(['ok'=>true]);
    }
    json_response(['ok'=>false,'error'=>'Unknown action.'], 400);
} catch (Throwable $e) {
    json_response(['ok'=>false,'error'=>$e->getMessage()], 400);
}
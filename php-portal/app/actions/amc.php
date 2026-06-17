<?php
require __DIR__ . '/../../includes/bootstrap.php';
$user = require_login();
verify_csrf();
header('Content-Type: application/json; charset=utf-8');

try {
    $action = (string)($_POST['action'] ?? '');
    if ($action === 'upsert') {
        $id = trim((string)($_POST['id'] ?? ''));
        $clientId = trim((string)($_POST['client_id'] ?? ''));
        if ($clientId === '') throw new RuntimeException('Client is required.');
        if (!$_POST['start_date'] || !$_POST['end_date'] || $_POST['allocated_hours'] === '') {
            throw new RuntimeException('Dates and allocated hours are required.');
        }
        $emails = array_values(array_filter(array_map('trim', preg_split('/[,\s]+/', (string)($_POST['notify_emails'] ?? '')))));
        $base = [
            'client_id' => $clientId,
            'website'   => trim((string)($_POST['website']  ?? '')) ?: null,
            'bd_person' => trim((string)($_POST['bd_person']?? '')) ?: null,
            'start_date'=> $_POST['start_date'],
            'end_date'  => $_POST['end_date'],
            'allocated_hours' => (float)$_POST['allocated_hours'],
            'notes'     => trim((string)($_POST['notes']    ?? '')) ?: null,
            'is_active' => 1,
            'notify_emails' => json_col($emails),
        ];
        if ($id === '') {
            $id = uuidv4();
            db_exec('INSERT INTO amc_clients (id, client_id, website, bd_person, start_date, end_date, allocated_hours, notes, is_active, notify_emails, sent_thresholds, sent_date_thresholds, created_by, updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                [$id, $base['client_id'], $base['website'], $base['bd_person'], $base['start_date'], $base['end_date'], $base['allocated_hours'], $base['notes'], 1, $base['notify_emails'], json_col([]), json_col([]), $user['id'], $user['id']]);
            log_activity('create', ['entity_type'=>'amc_client','entity_id'=>$id,'description'=>'Created AMC']);
            json_response(['ok'=>true,'id'=>$id,'message'=>'AMC created']);
        }
        db_exec('UPDATE amc_clients SET client_id=?, website=?, bd_person=?, start_date=?, end_date=?, allocated_hours=?, notes=?, notify_emails=?, updated_by=? WHERE id=?',
            [$base['client_id'], $base['website'], $base['bd_person'], $base['start_date'], $base['end_date'], $base['allocated_hours'], $base['notes'], $base['notify_emails'], $user['id'], $id]);
        log_activity('update', ['entity_type'=>'amc_client','entity_id'=>$id,'description'=>'Updated AMC']);
        json_response(['ok'=>true,'id'=>$id,'message'=>'AMC updated']);
    }
    if ($action === 'delete') {
        if (!is_super_admin()) throw new RuntimeException('Super Admin only.');
        $id = (string)($_POST['id'] ?? '');
        db_exec('DELETE FROM amc_clients WHERE id = ?', [$id]);
        log_activity('delete', ['entity_type'=>'amc_client','entity_id'=>$id,'description'=>'Deleted AMC']);
        json_response(['ok'=>true]);
    }
    if ($action === 'toggle_triggers') {
        if (!is_super_admin()) throw new RuntimeException('Super Admin only.');
        $id = (string)($_POST['id'] ?? '');
        $dis = (int)($_POST['disabled'] ?? 0) ? 1 : 0;
        db_exec('UPDATE amc_clients SET triggers_disabled = ? WHERE id = ?', [$dis, $id]);
        log_activity('update', ['entity_type'=>'amc_client','entity_id'=>$id,'description'=>($dis?'Disabled':'Re-enabled').' email triggers']);
        json_response(['ok'=>true]);
    }
    json_response(['ok'=>false,'error'=>'Unknown action.'], 400);
} catch (Throwable $e) {
    json_response(['ok'=>false,'error'=>$e->getMessage()], 400);
}
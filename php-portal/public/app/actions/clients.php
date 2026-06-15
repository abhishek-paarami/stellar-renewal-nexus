<?php
require __DIR__ . '/../../../includes/bootstrap.php';
$user = require_login();
verify_csrf();
header('Content-Type: application/json; charset=utf-8');

$action = (string)($_POST['action'] ?? '');

try {
    if ($action === 'upsert') {
        $id            = trim((string)($_POST['id'] ?? ''));
        $company_name  = trim((string)($_POST['company_name'] ?? ''));
        $primary_contact = trim((string)($_POST['primary_contact'] ?? ''));
        $primary_email = trim((string)($_POST['primary_email'] ?? ''));
        $primary_phone = trim((string)($_POST['primary_phone'] ?? ''));
        $address       = trim((string)($_POST['address'] ?? ''));
        $notes         = trim((string)($_POST['notes'] ?? ''));
        $client_type   = ($_POST['client_type'] ?? 'external') === 'internal' ? 'internal' : 'external';

        if ($company_name === '') throw new RuntimeException('Company name is required.');
        if ($primary_email !== '' && !filter_var($primary_email, FILTER_VALIDATE_EMAIL)) {
            throw new RuntimeException('Primary email is not valid.');
        }

        if ($id === '') {
            $id = uuidv4();
            db_exec(
                'INSERT INTO clients (id, company_name, primary_contact, primary_email, primary_phone, address, client_type, notes, contacts, created_by, updated_by)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?)',
                [$id, $company_name, $primary_contact ?: null, $primary_email ?: null, $primary_phone ?: null, $address ?: null, $client_type, $notes ?: null, json_col([]), $user['id'], $user['id']]
            );
            log_activity('create', ['entity_type' => 'client', 'entity_id' => $id, 'description' => "Created client \"$company_name\""]);
            json_response(['ok' => true, 'id' => $id, 'message' => 'Client created']);
        }

        db_exec(
            'UPDATE clients SET company_name=?, primary_contact=?, primary_email=?, primary_phone=?, address=?, client_type=?, notes=?, updated_by=? WHERE id=?',
            [$company_name, $primary_contact ?: null, $primary_email ?: null, $primary_phone ?: null, $address ?: null, $client_type, $notes ?: null, $user['id'], $id]
        );
        log_activity('update', ['entity_type' => 'client', 'entity_id' => $id, 'description' => "Updated client \"$company_name\""]);
        json_response(['ok' => true, 'id' => $id, 'message' => 'Client updated']);
    }

    if ($action === 'delete') {
        $id = (string)($_POST['id'] ?? '');
        if ($id === '') throw new RuntimeException('Missing id.');
        $row = db_one('SELECT company_name FROM clients WHERE id = ?', [$id]);
        if (!$row) throw new RuntimeException('Client not found.');
        db_exec('DELETE FROM clients WHERE id = ?', [$id]);
        log_activity('delete', ['entity_type' => 'client', 'entity_id' => $id, 'description' => "Deleted client \"{$row['company_name']}\""]);
        json_response(['ok' => true]);
    }

    json_response(['ok' => false, 'error' => 'Unknown action.'], 400);
} catch (Throwable $e) {
    json_response(['ok' => false, 'error' => $e->getMessage()], 400);
}
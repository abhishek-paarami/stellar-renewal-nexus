<?php
require __DIR__ . '/../../../includes/bootstrap.php';
$user = require_super_admin();
verify_csrf();
header('Content-Type: application/json; charset=utf-8');

try {
    $action = (string)($_POST['action'] ?? '');
    if ($action === 'save') {
        $id = (string)($_POST['id'] ?? '');
        $subject = trim((string)($_POST['subject'] ?? ''));
        $body    = (string)($_POST['html_body'] ?? '');
        if (!$id || $subject === '' || $body === '') throw new RuntimeException('Subject and body are required.');
        db_exec('UPDATE email_templates SET subject=?, html_body=?, updated_by=? WHERE id=?',
            [$subject, $body, $user['id'], $id]);
        log_activity('update', ['entity_type'=>'email_template','entity_id'=>$id,'description'=>'Updated email template']);
        json_response(['ok'=>true]);
    }
    json_response(['ok'=>false,'error'=>'Unknown action.'], 400);
} catch (Throwable $e) {
    json_response(['ok'=>false,'error'=>$e->getMessage()], 400);
}
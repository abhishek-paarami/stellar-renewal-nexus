<?php
/**
 * Externally-callable reminder cron endpoint.
 *
 * Hostinger:  set a cron job to GET (or POST) this URL once per day:
 *   curl -s "https://portal.example.com/api/cron-reminders.php?secret=YOUR_SECRET"
 *
 * The secret is read from config.php['cron']['secret'] when present, otherwise
 * falls back to a Super Admin session.
 */
require __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../../includes/reminders.php';

$cfg = $GLOBALS['paarami_config'];
$secret = $cfg['cron']['secret'] ?? '';
$given  = $_GET['secret'] ?? $_SERVER['HTTP_X_CRON_SECRET'] ?? '';

$ok = false;
if ($secret && hash_equals($secret, (string)$given)) $ok = true;
elseif (is_super_admin()) $ok = true;
if (!$ok) { http_response_code(401); header('Content-Type: application/json'); echo json_encode(['error'=>'Unauthorized']); exit; }

$res = run_reminder_dispatch();
log_activity('run', ['entity_type'=>'reminders','description'=>"Cron reminder run — {$res['sent']} sent", 'user_id'=>null]);
header('Content-Type: application/json; charset=utf-8');
echo json_encode(['ok'=>true,'sent'=>$res['sent']]);
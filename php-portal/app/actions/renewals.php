<?php
require __DIR__ . '/../../includes/bootstrap.php';
require_once __DIR__ . '/../../../includes/reminders.php';
$user = require_login();
verify_csrf();
header('Content-Type: application/json; charset=utf-8');

$action = (string)($_POST['action'] ?? '');
$isSA   = is_super_admin();

function ren_int_or_null($v) { $v = trim((string)$v); return $v === '' ? null : (int)$v; }
function ren_str_or_null($v) { $v = trim((string)$v); return $v === '' ? null : $v; }

try {
    if ($action === 'upsert') {
        $id     = trim((string)($_POST['id'] ?? ''));
        $domain = trim((string)($_POST['domain'] ?? ''));
        if ($domain === '') throw new RuntimeException('Domain is required.');

        $clientId   = ren_str_or_null($_POST['client_id'] ?? '');
        $clientType = ($_POST['client_type'] ?? 'external') === 'internal' ? 'internal' : 'external';
        if ($clientId) {
            $c = db_one('SELECT client_type FROM clients WHERE id = ?', [$clientId]);
            if ($c) $clientType = $c['client_type'];
        }
        $emails = array_values(array_filter(array_map('trim', preg_split('/[,\s]+/', (string)($_POST['contact_emails'] ?? '')))));

        $base = [
            'client_id'        => $clientId,
            'domain'           => $domain,
            'service_type'     => ren_str_or_null($_POST['service_type'] ?? ''),
            'ownership'        => ren_str_or_null($_POST['ownership'] ?? ''),
            'registrar'        => ren_str_or_null($_POST['registrar'] ?? ''),
            'hosting_provider' => ren_str_or_null($_POST['hosting_provider'] ?? ''),
            'domain_expiry'    => ren_str_or_null($_POST['domain_expiry'] ?? ''),
            'hosting_expiry'   => ren_str_or_null($_POST['hosting_expiry'] ?? ''),
            'ga_expiry'        => ren_str_or_null($_POST['ga_expiry'] ?? ''),
            'mail_type'        => ren_str_or_null($_POST['mail_type'] ?? ''),
            'email_count'      => ren_int_or_null($_POST['email_count'] ?? ''),
            'contact_person'   => ren_str_or_null($_POST['contact_person'] ?? ''),
            'phone_1'          => ren_str_or_null($_POST['phone_1'] ?? ''),
            'phone_2'          => ren_str_or_null($_POST['phone_2'] ?? ''),
            'client_type'      => $clientType,
            'notes'            => ren_str_or_null($_POST['notes'] ?? ''),
            'admin_url'        => ren_str_or_null($_POST['admin_url'] ?? ''),
            'panel_type'       => ren_str_or_null($_POST['panel_type'] ?? ''),
            'platform_type'    => ren_str_or_null($_POST['platform_type'] ?? ''),
            'ftp_host'         => ren_str_or_null($_POST['ftp_host'] ?? ''),
            'ftp_port'         => ren_int_or_null($_POST['ftp_port'] ?? ''),
            'contact_emails'   => json_col($emails),
        ];

        if ($id === '') {
            $id = uuidv4();
            $cols = array_keys($base);
            $cols[] = 'id'; $cols[] = 'sent_thresholds'; $cols[] = 'created_by'; $cols[] = 'updated_by';
            $vals = array_values($base);
            $vals[] = $id; $vals[] = json_col([]); $vals[] = $user['id']; $vals[] = $user['id'];
            $ph = implode(',', array_fill(0, count($cols), '?'));
            db_exec('INSERT INTO renewals (' . implode(',', $cols) . ") VALUES ($ph)", $vals);
            log_activity('create', ['entity_type'=>'renewal','entity_id'=>$id,'description'=>"Created renewal for \"$domain\""]);
        } else {
            $set = implode(',', array_map(fn($k) => "$k = ?", array_keys($base)));
            $vals = array_values($base);
            $vals[] = $user['id']; $vals[] = $id;
            db_exec("UPDATE renewals SET $set, updated_by = ? WHERE id = ?", $vals);
            log_activity('update', ['entity_type'=>'renewal','entity_id'=>$id,'description'=>"Updated renewal for \"$domain\""]);
        }

        // Credentials (super admin only). Blanks preserve existing values.
        if ($isSA) {
            $u  = (string)($_POST['username'] ?? '');
            $p  = (string)($_POST['password'] ?? '');
            $fu = (string)($_POST['ftp_username'] ?? '');
            $fp = (string)($_POST['ftp_password'] ?? '');
            $cur = db_one('SELECT username_enc, password_enc, ftp_username_enc, ftp_password_enc FROM renewals WHERE id = ?', [$id]);
            $upd = [];
            $upd['username_enc']     = $u !== '' ? vault_encrypt($u)  : ($cur['username_enc'] ?? null);
            $upd['password_enc']     = $p !== '' ? vault_encrypt($p)  : ($cur['password_enc'] ?? null);
            $upd['ftp_username_enc'] = $fu !== '' ? vault_encrypt($fu) : ($cur['ftp_username_enc'] ?? null);
            $upd['ftp_password_enc'] = $fp !== '' ? vault_encrypt($fp) : ($cur['ftp_password_enc'] ?? null);
            db_exec('UPDATE renewals SET username_enc=?, password_enc=?, ftp_username_enc=?, ftp_password_enc=? WHERE id=?',
                [$upd['username_enc'], $upd['password_enc'], $upd['ftp_username_enc'], $upd['ftp_password_enc'], $id]);

            $extra = [
                'ftp_protocol'          => ren_str_or_null($_POST['ftp_protocol'] ?? ''),
                'registrar_url'         => ren_str_or_null($_POST['registrar_url'] ?? ''),
                'registrar_email'       => ren_str_or_null($_POST['registrar_email'] ?? ''),
                'registrar_password'    => ren_str_or_null($_POST['registrar_password'] ?? ''),
                'registrar_customer_id' => ren_str_or_null($_POST['registrar_customer_id'] ?? ''),
                'hosting_url'           => ren_str_or_null($_POST['hosting_url'] ?? ''),
                'hosting_user_id'       => ren_str_or_null($_POST['hosting_user_id'] ?? ''),
                'hosting_password'      => ren_str_or_null($_POST['hosting_password'] ?? ''),
                'hosting_email'         => ren_str_or_null($_POST['hosting_email'] ?? ''),
            ];
            $hasAny = false; foreach ($extra as $v) if ($v) { $hasAny = true; break; }
            $blob = $hasAny ? vault_encrypt(json_encode($extra)) : null;
            db_exec('UPDATE renewals SET extra_creds_enc = ? WHERE id = ?', [$blob, $id]);
        }
        json_response(['ok' => true, 'id' => $id, 'message' => 'Saved']);
    }

    if ($action === 'delete') {
        if (!$isSA) throw new RuntimeException('Super Admin only.');
        $id = (string)($_POST['id'] ?? '');
        $row = db_one('SELECT domain FROM renewals WHERE id = ?', [$id]);
        if (!$row) throw new RuntimeException('Renewal not found.');
        db_exec('DELETE FROM renewals WHERE id = ?', [$id]);
        log_activity('delete', ['entity_type'=>'renewal','entity_id'=>$id,'description'=>"Deleted renewal for \"{$row['domain']}\""]);
        json_response(['ok' => true]);
    }

    if ($action === 'toggle_triggers') {
        if (!$isSA) throw new RuntimeException('Super Admin only.');
        $id = (string)($_POST['id'] ?? '');
        $disabled = (int)($_POST['disabled'] ?? 0) ? 1 : 0;
        db_exec('UPDATE renewals SET triggers_disabled = ? WHERE id = ?', [$disabled, $id]);
        $row = db_one('SELECT domain FROM renewals WHERE id = ?', [$id]);
        log_activity('update', ['entity_type'=>'renewal','entity_id'=>$id,
            'description'=>($disabled ? 'Disabled' : 'Re-enabled') . " email triggers for {$row['domain']}"]);
        json_response(['ok' => true]);
    }

    if ($action === 'get_creds') {
        if (!$isSA) throw new RuntimeException('Super Admin only.');
        $id = (string)($_POST['id'] ?? '');
        $r = db_one('SELECT * FROM renewals WHERE id = ?', [$id]);
        if (!$r) throw new RuntimeException('Not found.');
        db_exec('INSERT INTO credential_access_logs (id, renewal_id, accessed_by, ip_address, user_agent) VALUES (?,?,?,?,?)',
            [uuidv4(), $id, $user['id'], client_ip(), substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 500)]);
        json_response(['ok'=>true,'data'=>[
            'panel_type'   => $r['panel_type'],
            'admin_url'    => $r['admin_url'],
            'username'     => vault_decrypt($r['username_enc']),
            'password'     => vault_decrypt($r['password_enc']),
            'ftp_host'     => $r['ftp_host'],
            'ftp_port'     => $r['ftp_port'],
            'ftp_username' => vault_decrypt($r['ftp_username_enc']),
            'ftp_password' => vault_decrypt($r['ftp_password_enc']),
        ]]);
    }

    json_response(['ok' => false, 'error' => 'Unknown action.'], 400);
} catch (Throwable $e) {
    json_response(['ok' => false, 'error' => $e->getMessage()], 400);
}
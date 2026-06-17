<?php
require __DIR__ . '/../../includes/bootstrap.php';
$me = require_login(); $isSA = is_super_admin();

$action = $_GET['action'] ?? '';

/* ---------- EXPORT (GET, all roles) ---------- */
if ($action === 'export') {
    $kind = (string)($_GET['kind'] ?? '');
    header('Content-Type: application/json; charset=utf-8');
    try {
        switch ($kind) {
            case 'clients':
                $rows = db_all('SELECT company_name, primary_contact, primary_email, primary_phone, billing_contact, billing_email, address, client_type, notes, created_at FROM clients ORDER BY company_name');
                break;
            case 'renewals':
                $rows = db_all('SELECT r.domain, c.company_name AS client, r.service_type, r.ownership, r.registrar, r.hosting_provider,
                    r.domain_expiry, r.hosting_expiry, r.ga_expiry, r.mail_type, r.email_count,
                    r.contact_person, r.contact_emails, r.phone_1, r.phone_2, r.client_type, r.panel_type, r.admin_url, r.ftp_host, r.ftp_port, r.notes, r.created_at
                    FROM renewals r LEFT JOIN clients c ON c.id = r.client_id ORDER BY r.domain');
                foreach ($rows as &$r) $r['contact_emails'] = implode(', ', from_json_col($r['contact_emails'] ?? '[]', []));
                break;
            case 'amc':
                $rows = db_all('SELECT c.company_name AS client, a.website, a.bd_person, a.start_date, a.end_date,
                    a.allocated_hours, a.consumed_hours, a.is_active, a.notes, a.notify_emails, a.created_at
                    FROM amc_clients a LEFT JOIN clients c ON c.id = a.client_id ORDER BY c.company_name');
                foreach ($rows as &$r) $r['notify_emails'] = implode(', ', from_json_col($r['notify_emails'] ?? '[]', []));
                break;
            case 'time_entries':
                $rows = db_all('SELECT c.company_name AS client, a.website, t.developer_name AS developer, t.entry_date,
                    t.work_description, t.hours, t.minutes, t.is_billable, t.status, t.created_at
                    FROM time_entries t JOIN amc_clients a ON a.id = t.amc_client_id LEFT JOIN clients c ON c.id = a.client_id
                    ORDER BY t.entry_date DESC');
                break;
            default: throw new RuntimeException('Unknown kind.');
        }
        log_activity('export', ['entity_type'=>'import_export','description'=>"Exported $kind (" . count($rows) . " rows)"]);
        json_response(['ok'=>true,'rows'=>$rows]);
    } catch (Throwable $e) {
        json_response(['ok'=>false,'error'=>$e->getMessage()], 400);
    }
}

/* ---------- IMPORT (POST, super admin only) ---------- */
if (!$isSA) { http_response_code(403); exit('Forbidden — Super Admin only.'); }
verify_csrf();
header('Content-Type: application/json; charset=utf-8');

try {
    $kind = (string)($_POST['kind'] ?? '');
    $rows = json_decode((string)($_POST['rows'] ?? '[]'), true);
    if (!is_array($rows)) throw new RuntimeException('Invalid rows payload.');

    /* --- helpers --- */
    $pick = function(array $r, array $keys) {
        $norm = [];
        foreach ($r as $k=>$v) $norm[strtolower(preg_replace('/[^a-z0-9]+/i','_', (string)$k))] = $v;
        foreach ($keys as $k) {
            $kk = strtolower(preg_replace('/[^a-z0-9]+/i','_', $k));
            if (array_key_exists($kk, $norm) && $norm[$kk] !== null && $norm[$kk] !== '') return $norm[$kk];
        }
        return null;
    };
    $toStr  = fn($v) => $v===null ? null : trim((string)$v);
    $toInt  = fn($v) => ($v===null || $v==='') ? null : (int)$v;
    $toNum  = fn($v) => ($v===null || $v==='') ? null : (float)$v;
    $toBool = fn($v,$d=true) => $v===null ? $d : in_array(strtolower(trim((string)$v)), ['1','true','yes','y','active','t'], true);
    $toDate = function($v){
        if (!$v) return null;
        if ($v instanceof DateTime) return $v->format('Y-m-d');
        try { return (new DateTime((string)$v))->format('Y-m-d'); } catch (Throwable) { return null; }
    };
    $toEmails = function($v) {
        if (!$v) return [];
        return array_values(array_filter(array_map('trim', preg_split('/[,;\s]+/', (string)$v))));
    };
    $toClientType = fn($v) => strtolower((string)$v) === 'internal' ? 'internal' : 'external';
    $norm = fn($s) => strtolower(trim(preg_replace('/\s+/', ' ', (string)$s)));

    /* Cache clients map */
    $clientMap = [];
    foreach (db_all('SELECT id, company_name FROM clients') as $c) $clientMap[$norm($c['company_name'])] = $c['id'];
    $ensureClient = function(?string $name) use (&$clientMap, $norm) {
        if (!$name) return null;
        $k = $norm($name); if (!$k) return null;
        if (isset($clientMap[$k])) return $clientMap[$k];
        $id = uuidv4();
        db_exec('INSERT INTO clients (id, company_name, client_type, contacts) VALUES (?,?,?,?)', [$id, trim($name), 'external', json_col([])]);
        $clientMap[$k] = $id;
        return $id;
    };

    $ok = 0; $failed = 0; $errors = [];
    foreach ($rows as $idx => $row) {
        try {
            if ($kind === 'clients') {
                $name = $toStr($pick($row, ['company_name','company','client','client_name','name']));
                if (!$name) throw new RuntimeException('Missing company name');
                $payload = [
                    'primary_contact' => $toStr($pick($row, ['primary_contact','contact','contact_person'])),
                    'primary_email'   => $toStr($pick($row, ['primary_email','email'])),
                    'primary_phone'   => $toStr($pick($row, ['primary_phone','phone','mobile'])),
                    'billing_email'   => $toStr($pick($row, ['billing_email'])),
                    'billing_contact' => $toStr($pick($row, ['billing_contact'])),
                    'address'         => $toStr($pick($row, ['address','location'])),
                    'client_type'     => $toClientType($pick($row, ['client_type','type'])),
                    'notes'           => $toStr($pick($row, ['notes','remarks','comments'])),
                ];
                $k = $norm($name);
                if (isset($clientMap[$k])) {
                    db_exec('UPDATE clients SET primary_contact=?, primary_email=?, primary_phone=?, billing_email=?, billing_contact=?, address=?, client_type=?, notes=? WHERE id=?',
                        [...array_values($payload), $clientMap[$k]]);
                } else {
                    $id = uuidv4();
                    db_exec('INSERT INTO clients (id, company_name, primary_contact, primary_email, primary_phone, billing_email, billing_contact, address, client_type, notes, contacts) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
                        [$id, $name, ...array_values($payload), json_col([])]);
                    $clientMap[$k] = $id;
                }
            } elseif ($kind === 'renewals') {
                $domain = $toStr($pick($row, ['domain','website','url','site']));
                if (!$domain) throw new RuntimeException('Missing domain');
                $cid = $ensureClient($toStr($pick($row, ['client','company','company_name','client_name'])));
                $emails = $toEmails($pick($row, ['contact_emails','emails','email']));
                $id = uuidv4();
                db_exec('INSERT INTO renewals (id, client_id, domain, service_type, ownership, registrar, hosting_provider, domain_expiry, hosting_expiry, ga_expiry, mail_type, email_count, contact_person, contact_emails, phone_1, phone_2, client_type, notes, panel_type, admin_url, ftp_host, ftp_port, sent_thresholds) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
                    $id, $cid, $domain,
                    $toStr($pick($row, ['service_type','service'])),
                    $toStr($pick($row, ['ownership','owned_by'])),
                    $toStr($pick($row, ['registrar'])),
                    $toStr($pick($row, ['hosting_provider','hosting'])),
                    $toDate($pick($row, ['domain_expiry'])),
                    $toDate($pick($row, ['hosting_expiry'])),
                    $toDate($pick($row, ['ga_expiry','google_analytics_expiry'])),
                    $toStr($pick($row, ['mail_type','email_type'])),
                    $toInt($pick($row, ['email_count','mail_count'])),
                    $toStr($pick($row, ['contact_person','contact_name'])),
                    json_col($emails),
                    $toStr($pick($row, ['phone_1','phone','mobile'])),
                    $toStr($pick($row, ['phone_2','alt_phone','mobile_2'])),
                    $toClientType($pick($row, ['client_type','type'])),
                    $toStr($pick($row, ['notes','remarks'])),
                    $toStr($pick($row, ['panel_type','panel'])),
                    $toStr($pick($row, ['admin_url','panel_url','cpanel_url'])),
                    $toStr($pick($row, ['ftp_host','ftp_server'])),
                    $toInt($pick($row, ['ftp_port'])),
                    json_col([]),
                ]);
            } elseif ($kind === 'amc') {
                $cid = $ensureClient($toStr($pick($row, ['client','company','company_name','client_name'])));
                $start = $toDate($pick($row, ['start_date','amc_start','from'])) ?: date('Y-m-d');
                $end   = $toDate($pick($row, ['end_date','amc_end','to','expiry'])) ?: date('Y-m-d');
                $emails = $toEmails($pick($row, ['notify_emails','emails']));
                $id = uuidv4();
                db_exec('INSERT INTO amc_clients (id, client_id, website, bd_person, start_date, end_date, allocated_hours, consumed_hours, is_active, notes, notify_emails, sent_thresholds, sent_date_thresholds) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', [
                    $id, $cid,
                    $toStr($pick($row, ['website','url','domain','site'])),
                    $toStr($pick($row, ['bd_person','bd','business_developer','owner'])),
                    $start, $end,
                    $toNum($pick($row, ['allocated_hours','total_hours','hours'])) ?? 0,
                    $toNum($pick($row, ['consumed_hours','used_hours'])) ?? 0,
                    $toBool($pick($row, ['is_active','active','status']), true) ? 1 : 0,
                    $toStr($pick($row, ['notes','remarks'])),
                    json_col($emails),
                    json_col([]), json_col([]),
                ]);
            } elseif ($kind === 'time_entries') {
                $cname = $toStr($pick($row, ['client','company','company_name','client_name']));
                $site  = $toStr($pick($row, ['website','url','amc','domain']));
                $amc = null;
                if ($site) $amc = db_one('SELECT id FROM amc_clients WHERE website = ? LIMIT 1', [$site]);
                if (!$amc && $cname) {
                    $cid = $clientMap[$norm($cname)] ?? null;
                    if ($cid) $amc = db_one('SELECT id FROM amc_clients WHERE client_id = ? ORDER BY created_at DESC LIMIT 1', [$cid]);
                }
                if (!$amc) throw new RuntimeException('No matching AMC found for "' . ($cname ?: $site) . '"');
                $h = $toInt($pick($row, ['hours','hrs'])) ?? 0;
                $m = $toInt($pick($row, ['minutes','mins'])) ?? 0;
                $dur = $toNum($pick($row, ['duration','time','hours_decimal']));
                if ($dur && $h===0 && $m===0) { $h = (int)floor($dur); $m = (int)round(($dur - $h) * 60); }
                $status = strtolower((string)($toStr($pick($row, ['status'])) ?: 'approved'));
                if (!in_array($status, ['pending','approved','rejected'], true)) $status = 'approved';
                db_exec('INSERT INTO time_entries (id, amc_client_id, developer_name, entry_date, work_description, hours, minutes, is_billable, status, created_by) VALUES (?,?,?,?,?,?,?,?,?,?)', [
                    uuidv4(), $amc['id'],
                    $toStr($pick($row, ['developer','developer_name','user','person','by'])) ?: 'Unknown',
                    $toDate($pick($row, ['entry_date','date','work_date'])) ?: date('Y-m-d'),
                    $toStr($pick($row, ['work_description','description','task','details','work'])) ?: '',
                    $h, $m,
                    $toBool($pick($row, ['is_billable','billable']), true) ? 1 : 0,
                    $status, $me['id'],
                ]);
            } else { throw new RuntimeException('Unknown kind.'); }
            $ok++;
        } catch (Throwable $e) {
            $failed++;
            $errors[] = 'Row ' . ($idx + 2) . ': ' . $e->getMessage();
        }
    }
    log_activity('import', ['entity_type'=>'import_export','description'=>"Imported $ok rows ($failed failed) into $kind"]);
    json_response(['ok'=>true,'ok_count'=>$ok,'failed_count'=>$failed,'errors'=>$errors]);
} catch (Throwable $e) {
    json_response(['ok'=>false,'error'=>$e->getMessage()], 400);
}
<?php
declare(strict_types=1);

/**
 * Reminder engine + dynamic email-template auto-seeding.
 * Mirrors:
 *   - src/routes/_app/settings.tsx :: autoSeedTemplates()
 *   - supabase/functions/send-renewal-reminders/index.ts
 *   - supabase/functions/send-amc-instant-alert/index.ts
 */

function reminder_settings(): array {
    $row = db_one('SELECT value FROM app_settings WHERE `key` = ?', ['reminders']);
    $v   = $row ? from_json_col($row['value'], []) : [];
    $days = $v['renewal_days'] ?? null;
    if (!is_array($days)) {
        $csv = (string)($v['days_before'] ?? '30,7,1');
        $days = array_values(array_filter(array_map('intval', preg_split('/[\s,]+/', $csv)), fn($n) => $n > 0));
    }
    $pct = $v['amc_percents'] ?? '55,85,100';
    if (!is_array($pct)) $pct = array_values(array_filter(array_map('intval', preg_split('/[\s,]+/', (string)$pct)), fn($n) => $n > 0 && $n <= 100));
    $amcDays = $v['amc_days_before'] ?? '3,1';
    if (!is_array($amcDays)) $amcDays = array_values(array_filter(array_map('intval', preg_split('/[\s,]+/', (string)$amcDays)), fn($n) => $n > 0));
    rsort($days); rsort($pct); rsort($amcDays);
    return [
        'days_before'       => $days,
        'amc_percents'      => $pct,
        'amc_days_before'   => $amcDays,
        'send_after_expiry' => $v['send_after_expiry'] ?? true,
        'cc_internal'       => trim((string)($v['cc_internal'] ?? '')),
    ];
}

function render_template(string $tpl, array $vars): string {
    return preg_replace_callback('/\{\{(\w+)\}\}/', fn($m) => (string)($vars[$m[1]] ?? ''), $tpl);
}

/* ---------- Default templates (mirror settings.tsx defaultBody) ---------- */

function default_renewal_template(int $d): array {
    $plural = $d === 1 ? '' : 's';
    return [
        'key'     => "renewal_$d",
        'subject' => "Reminder: {{service_name}} expires in $d day$plural",
        'html'    => '<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:auto;background:#fff;padding:32px;border:1px solid #eee;border-radius:12px"><h2 style="color:#0f172a;margin:0 0 12px">Renewal due in <span style="color:#b91c1c">{{days_left}} day' . $plural . '</span></h2><p style="color:#475569">Hi {{contact_person}},</p><p style="color:#475569">Your <b>{{expiry_kind}}</b> for <b>{{domain}}</b> expires on <b>{{expiry_date}}</b>.</p><p style="color:#b91c1c;font-weight:600">Please initiate renewal to avoid service disruption.</p><p style="color:#94a3b8;font-size:12px;margin-top:24px">— Paarami Digital Operations</p></div>',
    ];
}

function default_amc_pct_template(int $p): array {
    return [
        'key'     => "amc_hours_$p",
        'subject' => 'AMC usage alert: {{client_name}} reached {{usage_pct}}%',
        'html'    => '<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:auto;background:#fff;padding:32px;border:1px solid #eee;border-radius:12px"><h2 style="color:#0f172a;margin:0 0 12px">AMC Usage Alert — <span style="color:#b91c1c">{{usage_pct}}% consumed</span></h2><p style="color:#475569">Hi {{contact_person}},</p><p style="color:#475569">Your AMC for <b>{{client_name}}</b> ({{cycle_month}}) has used <b>{{used_hours}}/{{allocated_hours}} hours</b> (<b>{{usage_pct}}%</b>).</p><p style="color:#b91c1c;font-weight:600">Remaining: {{remaining_hours}} hours.</p><p style="color:#94a3b8;font-size:12px;margin-top:24px">— Paarami Digital Operations</p></div>',
    ];
}

function default_amc_day_template(int $d): array {
    $plural = $d === 1 ? '' : 's';
    return [
        'key'     => "amc_expiry_$d",
        'subject' => "AMC for {{client_name}} expires in $d day$plural",
        'html'    => '<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:auto;background:#fff;padding:32px;border:1px solid #eee;border-radius:12px"><h2 style="color:#0f172a;margin:0 0 12px">AMC expires in <span style="color:#b91c1c">' . $d . ' day' . $plural . '</span></h2><p style="color:#475569">Hi {{contact_person}},</p><p style="color:#475569">AMC contract for <b>{{client_name}}</b> ends on <b>{{end_date}}</b>.</p><p style="color:#b91c1c;font-weight:600">Please initiate renewal to avoid service disruption.</p></div>',
    ];
}

/**
 * Dynamic auto-seed: inserts any template that is desired but missing,
 * deletes any threshold-template that is no longer in the desired set.
 */
function auto_seed_templates(array $days, array $percents, array $amcDays): void {
    $existing = db_all('SELECT template_key FROM email_templates');
    $have = array_column($existing, 'template_key');
    $have = array_flip($have);

    $desired = [];
    foreach ($days as $d) $desired["renewal_$d"] = true;
    $desired['renewal_expired'] = true;
    foreach ($percents as $p) $desired["amc_hours_$p"] = true;
    foreach ($amcDays as $d) $desired["amc_expiry_$d"] = true;
    $desired['amc_expired'] = true;

    foreach ($days as $d) {
        $k = "renewal_$d";
        if (!isset($have[$k])) {
            $t = default_renewal_template($d);
            db_exec('INSERT INTO email_templates (id, template_key, subject, html_body) VALUES (?,?,?,?)',
                [uuidv4(), $k, $t['subject'], $t['html']]);
        }
    }
    if (!isset($have['renewal_expired'])) {
        db_exec('INSERT INTO email_templates (id, template_key, subject, html_body) VALUES (?,?,?,?)',
            [uuidv4(), 'renewal_expired',
             'URGENT: {{service_name}} expired {{days_left}} day(s) ago',
             '<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:auto;background:#fff;padding:32px;border:1px solid #eee;border-radius:12px"><h2 style="color:#b91c1c;margin:0 0 12px">EXPIRED — {{days_left}} day(s) ago</h2><p style="color:#475569">Hi {{contact_person}},</p><p style="color:#475569">Your <b>{{expiry_kind}}</b> for <b>{{domain}}</b> expired on <b>{{expiry_date}}</b>.</p><p style="color:#b91c1c;font-weight:600">Please renew immediately to restore service.</p></div>']);
    }
    foreach ($percents as $p) {
        $k = "amc_hours_$p";
        if (!isset($have[$k])) {
            $t = default_amc_pct_template($p);
            db_exec('INSERT INTO email_templates (id, template_key, subject, html_body) VALUES (?,?,?,?)',
                [uuidv4(), $k, $t['subject'], $t['html']]);
        }
    }
    foreach ($amcDays as $d) {
        $k = "amc_expiry_$d";
        if (!isset($have[$k])) {
            $t = default_amc_day_template($d);
            db_exec('INSERT INTO email_templates (id, template_key, subject, html_body) VALUES (?,?,?,?)',
                [uuidv4(), $k, $t['subject'], $t['html']]);
        }
    }
    if (!isset($have['amc_expired'])) {
        db_exec('INSERT INTO email_templates (id, template_key, subject, html_body) VALUES (?,?,?,?)',
            [uuidv4(), 'amc_expired',
             'URGENT: AMC for {{client_name}} expired {{days_overdue}} day(s) ago',
             '<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:auto;background:#fff;padding:32px;border:1px solid #eee;border-radius:12px"><h2 style="color:#b91c1c;margin:0 0 12px">AMC EXPIRED — {{days_overdue}} day(s) ago</h2><p style="color:#475569">Hi {{contact_person}},</p><p style="color:#475569">AMC contract for <b>{{client_name}}</b> ended on <b>{{end_date}}</b>.</p><p style="color:#b91c1c;font-weight:600">Please renew the AMC to keep support active.</p></div>']);
    }

    // Orphan delete
    $stmt = db()->query('SELECT template_key FROM email_templates');
    $orphans = [];
    foreach ($stmt->fetchAll() as $row) {
        $k = $row['template_key'];
        if ((preg_match('/^renewal_\d+$/', $k) || preg_match('/^amc_hours_\d+$/', $k) || preg_match('/^amc_expiry_\d+$/', $k))
            && !isset($desired[$k])) {
            $orphans[] = $k;
        }
    }
    if ($orphans) {
        $in = implode(',', array_fill(0, count($orphans), '?'));
        db_exec("DELETE FROM email_templates WHERE template_key IN ($in)", $orphans);
    }
}

function tpl_map(): array {
    $out = [];
    foreach (db_all('SELECT template_key, subject, html_body FROM email_templates') as $t) {
        $out[$t['template_key']] = ['subject' => $t['subject'], 'html' => $t['html_body']];
    }
    return $out;
}

/**
 * Run the daily reminder dispatcher.
 * Returns ['sent' => int, 'skipped' => int].
 */
function run_reminder_dispatch(): array {
    require_once __DIR__ . '/mailer.php';
    $settings = reminder_settings();
    $tpls     = tpl_map();
    $cc       = $settings['cc_internal']
        ? array_values(array_filter(array_map('trim', explode(',', $settings['cc_internal']))))
        : [];
    $renewals = db_all('SELECT * FROM renewals');
    $clients  = db_all('SELECT id, company_name FROM clients');
    $clientNames = []; foreach ($clients as $c) $clientNames[$c['id']] = $c['company_name'];
    $amcs     = db_all('SELECT * FROM amc_clients');

    $sent = 0;
    $kinds = [
        ['field' => 'domain_expiry',  'label' => 'Domain'],
        ['field' => 'hosting_expiry', 'label' => 'Hosting'],
        ['field' => 'ga_expiry',      'label' => 'Google Apps'],
    ];

    foreach ($renewals as $r) {
        if (!empty($r['triggers_disabled'])) continue;
        $emails = from_json_col($r['contact_emails'] ?? '[]', []);
        $rcpts  = array_values(array_filter($emails, fn($e) => str_contains((string)$e, '@')));
        if (!$rcpts) continue;
        $sentMap = from_json_col($r['sent_thresholds'] ?? '{}', []);
        if (!is_array($sentMap)) $sentMap = [];

        foreach ($kinds as $k) {
            $date = $r[$k['field']] ?? null;
            if (!$date) continue;
            $d = days_until($date); if ($d === null) continue;
            $tplKey = null; $thr = null;
            $sentArr = array_map('intval', (array)($sentMap[$k['field']] ?? []));
            if ($d < 0 && $settings['send_after_expiry'] && !in_array(-1, $sentArr, true)) {
                $tplKey = 'renewal_expired'; $thr = -1;
            } elseif (in_array($d, $settings['days_before'], true) && !in_array($d, $sentArr, true)) {
                $tplKey = "renewal_$d"; $thr = $d;
            }
            if (!$tplKey) continue;
            $tpl = $tpls[$tplKey] ?? null; if (!$tpl) continue;
            $vars = [
                'client_name'    => $clientNames[$r['client_id'] ?? ''] ?? '',
                'domain'         => $r['domain'],
                'expiry_kind'    => $k['label'],
                'service_name'   => trim($k['label'] . ' — ' . ($r['domain'] ?? '')),
                'service_type'   => $k['label'],
                'expiry_date'    => $date,
                'days_left'      => $d < 0 ? abs($d) : $d,
                'contact_person' => $r['contact_person'] ?? '',
            ];
            $subject = render_template($tpl['subject'], $vars);
            $html    = render_template($tpl['html'], $vars);
            $res = send_mail($rcpts, $cc, $subject, $html, [
                'type' => 'renewal_reminder', 'entity' => 'renewal', 'related_id' => $r['id'],
            ]);
            $status = $res['ok'] ? 'success' : 'failed';
            db_exec('INSERT INTO reminder_logs (id, renewal_id, reminder_type, sent_to, status, error_message, expiry_kind)
                     VALUES (?,?,?,?,?,?,?)',
                [uuidv4(), $r['id'], $tplKey, json_col($rcpts), $status, $res['error'] ?? null, $k['label']]);
            if ($res['ok']) {
                $sent++;
                $sentArr[] = $thr; $sentArr = array_values(array_unique($sentArr));
                $sentMap[$k['field']] = $sentArr;
                db_exec('UPDATE renewals SET sent_thresholds = ? WHERE id = ?', [json_col($sentMap), $r['id']]);
            }
        }
    }

    foreach ($amcs as $a) {
        if (!empty($a['triggers_disabled'])) continue;
        $rcpts = array_values(array_filter(from_json_col($a['notify_emails'] ?? '[]', []), fn($e) => str_contains((string)$e, '@')));
        if (!$rcpts) continue;
        $allocated = (float)$a['allocated_hours']; $used = (float)$a['consumed_hours'];
        $pct = $allocated > 0 ? min(100, (int)round(($used / $allocated) * 100)) : 0;
        $remaining = max(0, $allocated - $used);
        $sentPct = array_map('intval', (array)from_json_col($a['sent_thresholds'] ?? '[]', []));
        $clientName = $clientNames[$a['client_id'] ?? ''] ?? '';

        if ($allocated > 0) {
            foreach ($settings['amc_percents'] as $thr) {
                if ($pct >= $thr && !in_array($thr, $sentPct, true)) {
                    $tpl = $tpls["amc_hours_$thr"] ?? null;
                    if ($tpl) {
                        $vars = [
                            'client_name' => $clientName, 'contact_person' => 'Team',
                            'allocated_hours' => $allocated, 'used_hours' => $used,
                            'remaining_hours' => $remaining, 'usage_pct' => $pct,
                            'monthly_hours' => $allocated, 'consumed_hours' => $used,
                            'cycle_month' => date('F Y'),
                            'end_date' => $a['end_date'] ?? '',
                        ];
                        $res = send_mail($rcpts, $cc,
                            render_template($tpl['subject'], $vars),
                            render_template($tpl['html'], $vars),
                            ['type' => 'amc_reminder', 'entity' => 'amc_client', 'related_id' => $a['id']]);
                        if ($res['ok']) {
                            $sent++;
                            $sentPct[] = $thr; $sentPct = array_values(array_unique($sentPct));
                            db_exec('UPDATE amc_clients SET sent_thresholds = ? WHERE id = ?', [json_col($sentPct), $a['id']]);
                        }
                    }
                    break;
                }
            }
        }

        if (empty($a['end_date'])) continue;
        $d = days_until($a['end_date']); if ($d === null) continue;
        $sentDay = array_map('intval', (array)from_json_col($a['sent_date_thresholds'] ?? '[]', []));
        $dKey = null; $dThr = null;
        if ($d < 0 && $settings['send_after_expiry'] && !in_array(-1, $sentDay, true)) {
            $dKey = 'amc_expired'; $dThr = -1;
        } elseif (in_array($d, $settings['amc_days_before'], true) && !in_array($d, $sentDay, true)) {
            $dKey = "amc_expiry_$d"; $dThr = $d;
        }
        if (!$dKey) continue;
        $tpl = $tpls[$dKey] ?? null; if (!$tpl) continue;
        $vars = [
            'client_name'   => $clientName, 'contact_person' => 'Team',
            'end_date'      => $a['end_date'],
            'days_left'     => $d, 'days_overdue' => abs($d),
        ];
        $res = send_mail($rcpts, $cc,
            render_template($tpl['subject'], $vars),
            render_template($tpl['html'], $vars),
            ['type' => 'amc_expiry', 'entity' => 'amc_client', 'related_id' => $a['id']]);
        if ($res['ok']) {
            $sent++;
            $sentDay[] = $dThr; $sentDay = array_values(array_unique($sentDay));
            db_exec('UPDATE amc_clients SET sent_date_thresholds = ? WHERE id = ?', [json_col($sentDay), $a['id']]);
        }
    }
    return ['sent' => $sent];
}

/**
 * Fire AMC threshold alert immediately after a time entry is approved
 * (mirror of supabase/functions/send-amc-instant-alert).
 */
function fire_amc_instant_alert(string $amcId, bool $force = false): array {
    require_once __DIR__ . '/mailer.php';
    $a = db_one('SELECT a.*, c.company_name FROM amc_clients a LEFT JOIN clients c ON c.id = a.client_id WHERE a.id = ?', [$amcId]);
    if (!$a) return ['sent' => 0, 'reason' => 'amc not found'];
    if (!empty($a['triggers_disabled'])) return ['sent' => 0, 'reason' => 'triggers_disabled'];
    $allocated = (float)$a['allocated_hours']; $used = (float)$a['consumed_hours'];
    if ($allocated <= 0) return ['sent' => 0, 'reason' => 'no allocation'];
    $settings = reminder_settings();
    $pct = min(100, (int)round(($used / $allocated) * 100));
    $sentPct = array_map('intval', (array)from_json_col($a['sent_thresholds'] ?? '[]', []));
    $step = null;
    foreach ($settings['amc_percents'] as $thr) {
        if ($pct >= $thr && ($force || !in_array($thr, $sentPct, true))) { $step = $thr; break; }
    }
    if ($step === null) return ['sent' => 0, 'reason' => 'no threshold', 'pct' => $pct];
    $tpls = tpl_map();
    $tpl  = $tpls["amc_hours_$step"] ?? null;
    if (!$tpl) return ['sent' => 0, 'reason' => 'template missing'];
    $rcpts = array_values(array_filter(from_json_col($a['notify_emails'] ?? '[]', []), fn($e) => str_contains((string)$e, '@')));
    if (!$rcpts) return ['sent' => 0, 'reason' => 'no recipients'];
    $cc = $settings['cc_internal']
        ? array_values(array_filter(array_map('trim', explode(',', $settings['cc_internal']))))
        : [];
    $vars = [
        'client_name' => $a['company_name'] ?? '',
        'contact_person' => 'Team',
        'allocated_hours' => $allocated, 'used_hours' => $used,
        'remaining_hours' => max(0, $allocated - $used),
        'usage_pct' => $pct, 'monthly_hours' => $allocated, 'consumed_hours' => $used,
        'cycle_month' => date('F Y'),
    ];
    $res = send_mail($rcpts, $cc,
        render_template($tpl['subject'], $vars),
        render_template($tpl['html'], $vars),
        ['type' => 'amc_instant', 'entity' => 'amc_client', 'related_id' => $a['id']]);
    if ($res['ok']) {
        $sentPct[] = $step; $sentPct = array_values(array_unique($sentPct));
        db_exec('UPDATE amc_clients SET sent_thresholds = ? WHERE id = ?', [json_col($sentPct), $a['id']]);
        return ['sent' => 1, 'threshold' => $step];
    }
    return ['sent' => 0, 'error' => $res['error'] ?? 'send failed'];
}
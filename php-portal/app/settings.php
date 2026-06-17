<?php
require __DIR__ . '/../includes/bootstrap.php';
require_super_admin();
$page_title = 'Settings';

$tab = (string)($_GET['tab'] ?? 'smtp');
$smtp = from_json_col(db_one('SELECT value FROM app_settings WHERE `key` = ?', ['smtp'])['value'] ?? null, []);
$rem  = from_json_col(db_one('SELECT value FROM app_settings WHERE `key` = ?', ['reminders'])['value'] ?? null, []);

$smtp += [
    'host'=>'','port'=>'587','secure'=>false,'username'=>'','password'=>'',
    'from_email'=>'','from_name'=>'Paarami Portal','enabled'=>true,'encryption'=>'tls',
];
$rem += [
    'days_before'=>'30,7,1','send_after_expiry'=>true,'cc_internal'=>'',
    'amc_percents'=>'55,85,100','amc_days_before'=>'3,1',
];
if (is_array($rem['amc_percents'])) $rem['amc_percents'] = implode(',', $rem['amc_percents']);
if (is_array($rem['amc_days_before'])) $rem['amc_days_before'] = implode(',', $rem['amc_days_before']);

// Log filters
$preset = (string)($_GET['preset'] ?? 'today');
$from = (string)($_GET['from'] ?? '');
$to   = (string)($_GET['to'] ?? '');
if (!$from && !$to) {
    $now = new DateTimeImmutable('now');
    if ($preset === 'today') { $from = $now->format('Y-m-d 00:00:00'); $to = $now->format('Y-m-d 23:59:59'); }
    elseif ($preset === '7d') { $from = $now->modify('-7 days')->format('Y-m-d 00:00:00'); $to = $now->format('Y-m-d 23:59:59'); }
    elseif ($preset === '30d') { $from = $now->modify('-30 days')->format('Y-m-d 00:00:00'); $to = $now->format('Y-m-d 23:59:59'); }
}

require __DIR__ . '/../../includes/layout_header.php';
?>
<?php render_page_header('Settings', 'SMTP, reminders, and activity log.'); ?>

<div class="tabs" style="margin-bottom:16px">
  <?php foreach (['smtp'=>['SMTP','mail'],'reminders'=>['Reminders','clock'],'email-log'=>['Email Log','mail'],'logs'=>['Reminder Log','refresh'],'activity'=>['Activity Log','layout']] as $k=>$v): ?>
    <a href="?tab=<?= $k ?>" class="tabs__btn<?= $tab===$k?' is-active':'' ?>"><?= icon($v[1]) ?><?= e($v[0]) ?></a>
  <?php endforeach; ?>
</div>

<?php if ($tab === 'smtp'): ?>
<div class="card" style="padding:24px">
  <h3 style="margin:0 0 4px;font-size:16px;font-weight:600">SMTP Configuration</h3>
  <p style="margin:0 0 16px;font-size:12px;color:var(--muted-foreground)">These credentials are used to send all reminder emails.</p>
  <form id="smtpForm" method="post" action="/app/actions/settings.php">
    <?= csrf_field() ?>
    <input type="hidden" name="action" value="save_smtp">
    <div class="form-grid">
      <div class="field"><label class="field__label">Host</label><input type="text" name="host" value="<?= e($smtp['host']) ?>" placeholder="smtp.gmail.com"></div>
      <div class="field"><label class="field__label">Port</label><input type="number" name="port" value="<?= e((string)$smtp['port']) ?>"></div>
      <div class="field"><label class="field__label">Username</label><input type="text" name="username" value="<?= e($smtp['username']) ?>"></div>
      <div class="field"><label class="field__label">Password</label><input type="password" name="password" value="<?= e($smtp['password']) ?>"></div>
      <div class="field"><label class="field__label">From Email</label><input type="email" name="from_email" value="<?= e($smtp['from_email']) ?>"></div>
      <div class="field"><label class="field__label">From Name</label><input type="text" name="from_name" value="<?= e($smtp['from_name']) ?>"></div>
      <div class="field col-2 switch-row"><label class="switch <?= !empty($smtp['secure'])?'is-on':'' ?>" data-switch><input type="checkbox" name="secure" value="1" <?= !empty($smtp['secure'])?'checked':'' ?>></label><label class="field__label" style="margin:0">Use SSL/TLS (port 465)</label></div>
      <div class="field col-2 switch-row"><label class="switch <?= !empty($smtp['enabled'])?'is-on':'' ?>" data-switch><input type="checkbox" name="enabled" value="1" <?= !empty($smtp['enabled'])?'checked':'' ?>></label><label class="field__label" style="margin:0">Enable email sending</label></div>
    </div>
    <div style="display:flex;gap:12px;align-items:center;margin-top:18px;padding-top:14px;border-top:1px solid var(--border);flex-wrap:wrap">
      <button type="submit" class="btn btn--gradient">Save SMTP</button>
      <div style="margin-left:auto;display:flex;gap:8px;align-items:center">
        <input type="email" id="testEmail" placeholder="test@example.com" style="height:38px;padding:0 12px;border-radius:8px;border:1px solid var(--border);background:var(--card);width:220px">
        <button type="button" class="btn btn--ghost" data-send-test>Send Test</button>
      </div>
    </div>
  </form>
</div>

<?php elseif ($tab === 'reminders'): ?>
<div class="card" style="padding:24px">
  <h3 style="margin:0 0 4px;font-size:16px;font-weight:600">Reminder Schedule</h3>
  <p style="margin:0 0 16px;font-size:12px;color:var(--muted-foreground)">A daily cron sends reminders at 09:00 IST. You can also trigger a run manually.</p>
  <form id="remForm" method="post" action="/app/actions/settings.php">
    <?= csrf_field() ?>
    <input type="hidden" name="action" value="save_reminders">
    <div class="form-grid">
      <div class="field"><label class="field__label">Days Before Expiry (CSV)</label><input type="text" name="days_before" value="<?= e($rem['days_before']) ?>" placeholder="30,7,1"></div>
      <div class="field">
        <label class="field__label">AMC % Thresholds (CSV)</label>
        <input type="text" name="amc_percents" value="<?= e($rem['amc_percents']) ?>" placeholder="55,85,100">
        <div class="field__hint">Alert fires when consumed hours reach each %. Used everywhere: cron, instant alerts, card badges.</div>
      </div>
      <div class="field">
        <label class="field__label">AMC Days Before Expiry (CSV)</label>
        <input type="text" name="amc_days_before" value="<?= e($rem['amc_days_before']) ?>" placeholder="3,1">
        <div class="field__hint">Reminder fires N days before the AMC end_date; expired AMCs get a daily "X days ago" alert when the toggle below is on.</div>
      </div>
      <div class="field col-2"><label class="field__label">Always CC (comma separated)</label><textarea name="cc_internal" rows="2" placeholder="ops@paaramidigital.com"><?= e($rem['cc_internal']) ?></textarea></div>
      <div class="field col-2 switch-row"><label class="switch <?= !empty($rem['send_after_expiry'])?'is-on':'' ?>" data-switch><input type="checkbox" name="send_after_expiry" value="1" <?= !empty($rem['send_after_expiry'])?'checked':'' ?>></label><label class="field__label" style="margin:0">Also send when already expired</label></div>
    </div>
    <div style="display:flex;gap:12px;margin-top:18px;padding-top:14px;border-top:1px solid var(--border)">
      <button type="submit" class="btn btn--gradient">Save</button>
      <button type="button" class="btn btn--ghost" data-run-now>Run reminders now</button>
    </div>
  </form>
</div>

<?php else:
  $tableMap = ['email-log'=>['email_logs','sent_at'],'logs'=>['reminder_logs','sent_at'],'activity'=>['activity_logs','created_at']];
  [$tbl, $tcol] = $tableMap[$tab];
  $logs = db_all("SELECT * FROM $tbl WHERE $tcol BETWEEN ? AND ? ORDER BY $tcol DESC LIMIT 500", [$from ?: '1970-01-01', $to ?: '2999-01-01']);
?>
<div class="card" style="overflow:hidden">
  <form method="get" class="logbar">
    <input type="hidden" name="tab" value="<?= e($tab) ?>">
    <?php foreach (['today'=>'Today','7d'=>'7 days','30d'=>'30 days'] as $p=>$lbl): ?>
      <a href="?tab=<?= e($tab) ?>&preset=<?= $p ?>" class="btn btn--ghost btn--sm<?= $preset===$p?' is-active':'' ?>" style="<?= $preset===$p?'border-color:var(--primary);color:var(--primary)':'' ?>"><?= $lbl ?></a>
    <?php endforeach; ?>
    <span style="color:var(--muted-foreground);font-size:11px">From</span><input type="date" name="from" value="<?= e(substr($from,0,10)) ?>">
    <span style="color:var(--muted-foreground);font-size:11px">To</span><input type="date" name="to" value="<?= e(substr($to,0,10)) ?>">
    <button type="submit" class="btn btn--ghost btn--sm">Apply</button>
    <a href="/app/actions/settings.php?action=export_log&type=<?= e($tab) ?>&from=<?= e($from) ?>&to=<?= e($to) ?>" class="btn btn--ghost btn--sm" style="margin-left:auto">Export CSV</a>
  </form>
  <div style="overflow-x:auto"><table class="table">
    <?php if ($tab === 'logs'): ?>
      <thead><tr><th>When</th><th>Type</th><th>Kind</th><th>To</th><th>Status</th></tr></thead><tbody>
      <?php foreach ($logs as $l): ?>
        <tr><td style="font-size:11px"><?= e(format_date($l['sent_at'], 'd M Y H:i')) ?></td>
          <td><span class="badge"><?= e($l['reminder_type']) ?></span></td>
          <td style="font-size:11px;color:var(--muted-foreground)"><?= e($l['expiry_kind'] ?? '—') ?></td>
          <td style="font-size:11px;color:var(--muted-foreground)"><?= e(implode(', ', from_json_col($l['sent_to'] ?? '[]', []))) ?></td>
          <td><span class="badge <?= $l['status']==='success'?'badge--success':'badge--danger' ?>"><?= e($l['status']) ?></span><?php if ($l['error_message']): ?><div style="margin-top:4px;font-size:10px;color:var(--destructive)"><?= e($l['error_message']) ?></div><?php endif; ?></td>
        </tr>
      <?php endforeach; if(!$logs): ?><tr><td colspan="5" style="text-align:center;padding:32px;color:var(--muted-foreground)">No reminders sent yet.</td></tr><?php endif; ?>
      </tbody>
    <?php elseif ($tab === 'email-log'): ?>
      <thead><tr><th>When</th><th>Type</th><th>To</th><th>Subject</th><th>Status</th></tr></thead><tbody>
      <?php foreach ($logs as $l): ?>
        <tr><td style="font-size:11px;white-space:nowrap"><?= e(format_date($l['sent_at'], 'd M Y H:i')) ?></td>
          <td><span class="badge"><?= e($l['email_type']) ?></span></td>
          <td style="font-size:11px"><?= e(implode(', ', from_json_col($l['to_addresses'] ?? '[]', []))) ?></td>
          <td style="font-size:11px"><?= e($l['subject'] ?? '—') ?></td>
          <td><span class="badge <?= $l['status']==='success'?'badge--success':($l['status']==='skipped'?'badge--muted':'badge--danger') ?>"><?= e($l['status']) ?></span><?php if ($l['error_message']): ?><div style="margin-top:4px;font-size:10px;color:var(--destructive)"><?= e($l['error_message']) ?></div><?php endif; ?></td>
        </tr>
      <?php endforeach; if(!$logs): ?><tr><td colspan="5" style="text-align:center;padding:32px;color:var(--muted-foreground)">No emails sent yet.</td></tr><?php endif; ?>
      </tbody>
    <?php else: /* activity */ ?>
      <thead><tr><th>When</th><th>User</th><th>Action</th><th>Entity</th><th>Description</th></tr></thead><tbody>
      <?php
        $users = db_all('SELECT id, full_name, email FROM user_profiles');
        $nameById = []; foreach ($users as $u) $nameById[$u['id']] = $u['full_name'] ?: $u['email'];
        foreach ($logs as $l): ?>
        <tr><td style="font-family:ui-monospace,monospace;font-size:11px"><?= e(format_date($l['created_at'], 'd M Y H:i')) ?></td>
          <td style="font-weight:500"><?= e($nameById[$l['user_id']] ?? ($l['user_id'] ? substr($l['user_id'],0,8) : 'system')) ?></td>
          <td><span class="badge"><?= e($l['action_type']) ?></span></td>
          <td style="font-size:11px;color:var(--muted-foreground)"><?= e($l['entity_type'] ?? '—') ?></td>
          <td style="font-size:11px"><?= e($l['description'] ?? '—') ?></td>
        </tr>
      <?php endforeach; if(!$logs): ?><tr><td colspan="5" style="text-align:center;padding:32px;color:var(--muted-foreground)">No activity yet.</td></tr><?php endif; ?>
      </tbody>
    <?php endif; ?>
  </table></div>
</div>
<?php endif; ?>

<script>
(function(){
  // switch toggles
  document.querySelectorAll('[data-switch]').forEach(s => s.addEventListener('click', e => {
    if (e.target.tagName === 'INPUT') return;
    const cb = s.querySelector('input'); cb.checked = !cb.checked; s.classList.toggle('is-on', cb.checked);
  }));
  // generic form submit with toast
  const ajaxForm = (id, okMsg) => {
    const f = document.getElementById(id); if (!f) return;
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = f.querySelector('button[type=submit]'); btn.disabled=true; const orig=btn.textContent; btn.textContent='Saving…';
      try{const fd=new FormData(f); const r=await fetch(f.action,{method:'POST',body:fd,credentials:'same-origin'}); const j=await r.json();
        if(!r.ok||!j.ok) throw new Error(j.error||'Save failed'); toast(j.message||okMsg,'success');
      } catch(err){toast(err.message,'error');} finally{btn.disabled=false;btn.textContent=orig;}
    });
  };
  ajaxForm('smtpForm','SMTP saved'); ajaxForm('remForm','Reminder settings saved — templates synced');

  document.querySelector('[data-send-test]')?.addEventListener('click', async () => {
    const to = document.getElementById('testEmail').value.trim();
    if (!to) return toast('Enter a test email','error');
    try{const j=await postJSON('/app/actions/settings.php',{action:'send_test',to}); if(!j.ok) throw new Error(j.error||'Failed');
      toast('Test email sent to '+to,'success');
    } catch(err){toast(err.message,'error');}
  });
  document.querySelector('[data-run-now]')?.addEventListener('click', async () => {
    try{const j=await postJSON('/app/actions/settings.php',{action:'run_reminders'}); if(!j.ok) throw new Error(j.error||'Failed');
      toast('Reminder run complete: '+(j.sent||0)+' sent','success');
    } catch(err){toast(err.message,'error');}
  });
})();
</script>
<?php require __DIR__ . '/../../includes/layout_footer.php'; ?>
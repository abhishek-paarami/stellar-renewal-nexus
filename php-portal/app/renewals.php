<?php
require __DIR__ . '/../includes/bootstrap.php';
$user = require_login(); $isSA = is_super_admin();
$page_title = 'Renewals';

$q      = trim((string)($_GET['q'] ?? ''));
$filter = (string)($_GET['filter'] ?? 'all');   // all|expired|critical|warning|ok
$sort   = (string)($_GET['sort']   ?? 'expiry_asc');

$rows = db_all('SELECT r.*, c.company_name, c.client_type AS c_type
                FROM renewals r LEFT JOIN clients c ON c.id = r.client_id
                ORDER BY r.domain_expiry IS NULL, r.domain_expiry ASC');

// In-memory filter + sort to match Lovable semantics.
$earliest = function (array $r): ?string {
    $d = array_values(array_filter([$r['domain_expiry'] ?? null, $r['hosting_expiry'] ?? null, $r['ga_expiry'] ?? null]));
    sort($d); return $d[0] ?? null;
};
$variant = function (?string $iso): string {
    if (!$iso) return 'none';
    $d = days_until($iso);
    if ($d === null) return 'none';
    if ($d < 0) return 'expired';
    if ($d <= 7) return 'critical';
    if ($d <= 30) return 'warning';
    return 'ok';
};
$rows = array_values(array_filter($rows, function ($r) use ($q, $filter, $earliest, $variant) {
    if ($q !== '') {
        $blob = strtolower($r['domain'] . ' ' . ($r['company_name'] ?? '') . ' ' . ($r['contact_person'] ?? '') . ' ' . ($r['registrar'] ?? ''));
        if (!str_contains($blob, strtolower($q))) return false;
    }
    if ($filter === 'all') return true;
    return $variant($earliest($r)) === $filter;
}));
usort($rows, function ($a, $b) use ($sort, $earliest) {
    if ($sort === 'az') return strcasecmp($a['domain'], $b['domain']);
    if ($sort === 'za') return strcasecmp($b['domain'], $a['domain']);
    $ea = $earliest($a); $eb = $earliest($b);
    if (!$ea && !$eb) return 0;
    if (!$ea) return 1;
    if (!$eb) return -1;
    return $sort === 'expiry_asc' ? strcmp($ea, $eb) : strcmp($eb, $ea);
});

$clients = db_all('SELECT id, company_name, client_type FROM clients ORDER BY company_name');
$clientsJson = json_encode($clients, JSON_UNESCAPED_UNICODE);

require __DIR__ . '/../includes/layout_header.php';
?>
<?php render_page_header('Renewals', 'Domains, hosting, Google Apps & mail expiries.',
    '<button type="button" class="btn btn--gradient" data-renewal-new>' . icon('refresh') . ' New Renewal</button>'
); ?>

<form method="get" class="toolbar">
  <div class="toolbar__search">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
    <input type="text" name="q" value="<?= e($q) ?>" placeholder="Search domain, client, contact..." autocomplete="off">
  </div>
  <div class="tabs">
    <?php foreach (['all'=>'All','expired'=>'Expired','critical'=>'≤7d','warning'=>'≤30d','ok'=>'Healthy'] as $k=>$lbl): ?>
      <button type="submit" name="filter" value="<?= $k ?>" class="tabs__btn<?= $filter===$k?' is-active':'' ?>"><?= $lbl ?></button>
    <?php endforeach; ?>
  </div>
  <select class="select" name="sort" onchange="this.form.submit()">
    <?php foreach (['expiry_asc'=>'Expiry: soonest first','expiry_desc'=>'Expiry: latest first','az'=>'Domain: A → Z','za'=>'Domain: Z → A'] as $k=>$lbl): ?>
      <option value="<?= $k ?>"<?= $sort===$k?' selected':'' ?>><?= e($lbl) ?></option>
    <?php endforeach; ?>
  </select>
  <span class="badge"><?= count($rows) ?> renewals</span>
  <input type="hidden" name="filter" value="<?= e($filter) ?>">
</form>

<?php if (!$rows): ?>
  <div class="table-card"><div class="empty">
    <div class="empty__icon"><?= icon('refresh') ?></div>
    <p class="empty__t">No renewals</p>
    <p class="empty__d">Add your first renewal entry.</p>
  </div></div>
<?php else: ?>
  <div class="table-card"><div style="overflow-x:auto"><table class="table">
    <thead><tr>
      <th>Domain</th><th>Client</th><th>Domain Exp</th><th>Hosting Exp</th><th>GA Exp</th><th>Contact</th><th style="text-align:right">Actions</th>
    </tr></thead>
    <tbody>
    <?php foreach ($rows as $r):
      $badge = function($iso) use ($variant) {
        $v = $variant($iso);
        if ($v === 'none') return '<span class="badge badge--muted">—</span>';
        $d = days_until($iso);
        $cls = $v === 'expired' || $v === 'critical' ? 'badge--danger' : ($v === 'warning' ? 'badge--warning' : 'badge--success');
        $lbl = $d < 0 ? "Expired " . abs($d) . "d ago" : $d . "d left";
        return '<span class="badge ' . $cls . '">' . e($lbl) . '</span>';
      };
      $extra = vault_decrypt($r['extra_creds_enc'] ?? null);
      $extraJson = $extra ? json_decode($extra, true) ?: [] : [];
      $data = [
        'id' => $r['id'], 'domain' => $r['domain'],
        'client_id' => (string)($r['client_id'] ?? ''),
        'service_type'=>$r['service_type']??'','ownership'=>$r['ownership']??'',
        'registrar'=>$r['registrar']??'','hosting_provider'=>$r['hosting_provider']??'',
        'domain_expiry'=>$r['domain_expiry']??'','hosting_expiry'=>$r['hosting_expiry']??'','ga_expiry'=>$r['ga_expiry']??'',
        'mail_type'=>$r['mail_type']??'','email_count'=>$r['email_count']??'',
        'contact_person'=>$r['contact_person']??'','phone_1'=>$r['phone_1']??'','phone_2'=>$r['phone_2']??'',
        'contact_emails'=>implode(', ', from_json_col($r['contact_emails'] ?? '[]', [])),
        'client_type'=>$r['client_type']??'external','notes'=>$r['notes']??'',
        'admin_url'=>$r['admin_url']??'','panel_type'=>$r['panel_type']??'',
        'platform_type'=>$r['platform_type']??'',
        'ftp_host'=>$r['ftp_host']??'','ftp_port'=>$r['ftp_port']??'',
        'username'=>$isSA?(string)(vault_decrypt($r['username_enc']??null)??''):'',
        'password'=>$isSA?(string)(vault_decrypt($r['password_enc']??null)??''):'',
        'ftp_username'=>$isSA?(string)(vault_decrypt($r['ftp_username_enc']??null)??''):'',
        'ftp_password'=>$isSA?(string)(vault_decrypt($r['ftp_password_enc']??null)??''):'',
        'triggers_disabled'=>(int)($r['triggers_disabled'] ?? 0),
      ] + ($isSA ? array_intersect_key($extraJson, array_flip(['ftp_protocol','registrar_url','registrar_email','registrar_password','registrar_customer_id','hosting_url','hosting_user_id','hosting_password','hosting_email'])) : []);
    ?>
      <tr>
        <td><b><?= e($r['domain']) ?></b><div style="font-size:12px;color:var(--muted-foreground)"><?= e($r['registrar'] ?? '—') ?></div></td>
        <td><?= e($r['company_name'] ?? '—') ?><div style="margin-top:2px"><span class="badge badge--muted"><?= e($r['c_type'] ?? $r['client_type']) ?></span></div></td>
        <td><div style="font-size:12px"><?= e(format_date($r['domain_expiry'])) ?></div><?= $badge($r['domain_expiry']) ?></td>
        <td><div style="font-size:12px"><?= e(format_date($r['hosting_expiry'])) ?></div><?= $badge($r['hosting_expiry']) ?></td>
        <td><div style="font-size:12px"><?= e(format_date($r['ga_expiry'])) ?></div><?= $badge($r['ga_expiry']) ?></td>
        <td style="font-size:12px;color:var(--muted-foreground)"><div><?= e($r['contact_person'] ?? '—') ?></div><div><?= e($r['phone_1'] ?? '') ?></div></td>
        <td style="text-align:right;white-space:nowrap">
          <div class="row-actions">
            <?php if ($isSA): ?>
              <button type="button" class="icon-btn" title="View credentials" data-vault="<?= e($r['id']) ?>"><?= icon('key') ?></button>
              <button type="button" class="icon-btn<?= !empty($r['triggers_disabled']) ? ' icon-btn--danger':'' ?>" title="<?= !empty($r['triggers_disabled']) ? 'Re-enable email triggers' : 'Disable email triggers' ?>" data-trigger="<?= e($r['id']) ?>" data-disabled="<?= (int)!empty($r['triggers_disabled']) ?>" data-domain="<?= e($r['domain']) ?>">
                <?php if (!empty($r['triggers_disabled'])): ?>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.9 17.9 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M2 2l20 20"/></svg>
                <?php else: ?>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                <?php endif; ?>
              </button>
            <?php endif; ?>
            <button type="button" class="icon-btn" title="Edit" data-renewal-edit='<?= e(json_encode($data, JSON_UNESCAPED_UNICODE)) ?>'>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/></svg>
            </button>
            <?php if ($isSA): ?>
              <button type="button" class="icon-btn icon-btn--danger" title="Delete" data-renewal-delete="<?= e($r['id']) ?>" data-domain="<?= e($r['domain']) ?>">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6 17.4 20.2A2 2 0 0 1 15.4 22H8.6a2 2 0 0 1-2-1.8L5 6"/></svg>
              </button>
            <?php endif; ?>
          </div>
        </td>
      </tr>
    <?php endforeach; ?>
    </tbody></table></div></div>
<?php endif; ?>

<!-- ====== Big Dialog: New / Edit Renewal ====== -->
<div class="dialog-back" data-dialog-back="renewalDialog"></div>
<div class="dialog-back" style="z-index:90;display:none" id="renewalShell">
  <div class="dialog dialog--lg" role="dialog" aria-modal="true">
    <div class="dialog__head">
      <h3 class="dialog__title" data-rt>New Renewal</h3>
      <p class="dialog__sub">Manage domain, hosting, GA expiry & credentials.</p>
    </div>
    <form id="renewalForm" class="dialog__body" method="post" action="/app/actions/renewals.php" novalidate>
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="upsert">
      <input type="hidden" name="id" value="">
      <div class="form-grid">
        <div class="field col-2"><label class="field__label">Domain <span class="req">*</span></label><input type="text" name="domain" required placeholder="example.com"></div>
        <div class="field col-2"><label class="field__label">Client</label>
          <select name="client_id" id="renewal_client"><option value="">— None —</option></select>
          <div class="field__hint">Type (Internal/External) is taken from the selected client.</div>
        </div>
        <div class="field"><label class="field__label">Service Type</label><input type="text" name="service_type" placeholder="Domain + Hosting"></div>
        <div class="field"><label class="field__label">Ownership</label><input type="text" name="ownership" placeholder="Client / Paarami"></div>
        <div class="field"><label class="field__label">Registrar</label><input type="text" name="registrar"></div>
        <div class="field"><label class="field__label">Hosting Provider</label><input type="text" name="hosting_provider"></div>
        <div class="field"><label class="field__label">Domain Expiry</label><input type="date" name="domain_expiry"></div>
        <div class="field"><label class="field__label">Hosting Expiry</label><input type="date" name="hosting_expiry"></div>
        <div class="field"><label class="field__label">GA Expiry</label><input type="date" name="ga_expiry"></div>
        <div class="field"><label class="field__label">Mail Type</label><input type="text" name="mail_type" placeholder="Google Workspace / Zoho / cPanel"></div>
        <div class="field"><label class="field__label">Email Count</label><input type="number" name="email_count"></div>
        <div class="field"><label class="field__label">Contact Person</label><input type="text" name="contact_person"></div>
        <div class="field"><label class="field__label">Phone 1</label><input type="text" name="phone_1"></div>
        <div class="field"><label class="field__label">Phone 2</label><input type="text" name="phone_2"></div>
        <div class="field col-2"><label class="field__label">Reminder Emails (comma separated)</label><input type="text" name="contact_emails" placeholder="ops@example.com, billing@example.com"></div>

        <?php if ($isSA): ?>
        <div class="form-section-title">Hosting Credentials (encrypted at rest) — Platform</div>
        <div class="field"><label class="field__label">Platform Type</label><input type="text" name="platform_type" placeholder="WordPress / Shopify / Wix"></div>
        <div class="field"><label class="field__label">Admin URL</label><input type="text" name="admin_url"></div>
        <div class="field"><label class="field__label">User ID</label><input type="text" name="username" placeholder="(leave blank to keep)"></div>
        <div class="field"><label class="field__label">Password</label><input type="password" name="password" placeholder="(leave blank to keep)"></div>

        <div class="form-section-title">Panel</div>
        <div class="field"><label class="field__label">Panel Type</label><input type="text" name="panel_type" placeholder="cPanel / Plesk / WHM"></div>
        <div class="field"><label class="field__label">Panel URL (Host)</label><input type="text" name="ftp_host" placeholder="host.example.com"></div>
        <div class="field"><label class="field__label">Panel User ID</label><input type="text" name="ftp_username"></div>
        <div class="field"><label class="field__label">Panel Password</label><input type="password" name="ftp_password"></div>
        <div class="field"><label class="field__label">Port</label><input type="number" name="ftp_port"></div>
        <div class="field"><label class="field__label">Protocol Type</label><input type="text" name="ftp_protocol" placeholder="FTP / SFTP / Storj"></div>

        <div class="form-section-title">Domain Registrar</div>
        <div class="field"><label class="field__label">Registrar URL</label><input type="text" name="registrar_url"></div>
        <div class="field"><label class="field__label">Registrar User Email</label><input type="text" name="registrar_email"></div>
        <div class="field"><label class="field__label">Registrar Password</label><input type="password" name="registrar_password"></div>
        <div class="field"><label class="field__label">Customer ID</label><input type="text" name="registrar_customer_id"></div>

        <div class="form-section-title">Hosting</div>
        <div class="field"><label class="field__label">Hosting URL</label><input type="text" name="hosting_url"></div>
        <div class="field"><label class="field__label">Hosting User ID</label><input type="text" name="hosting_user_id"></div>
        <div class="field"><label class="field__label">Hosting Password</label><input type="password" name="hosting_password"></div>
        <div class="field"><label class="field__label">Hosting Email ID</label><input type="text" name="hosting_email"></div>
        <?php endif; ?>

        <div class="field col-2"><label class="field__label">Notes</label><textarea name="notes" rows="2"></textarea></div>
      </div>
    </form>
    <div class="dialog__foot">
      <button type="button" class="btn btn--ghost" data-dialog-close>Cancel</button>
      <button type="submit" form="renewalForm" class="btn btn--gradient" data-renewal-submit>Create</button>
    </div>
  </div>
</div>

<!-- ====== Vault dialog (super admin only) ====== -->
<div class="dialog-back" id="vaultShell">
  <div class="dialog dialog--md" role="dialog" aria-modal="true">
    <div class="dialog__head">
      <h3 class="dialog__title">Credentials</h3>
      <p class="dialog__sub">This access is logged & audited. Super Admin only.</p>
    </div>
    <div class="dialog__body" id="vaultBody"><div style="text-align:center;color:var(--muted-foreground);padding:32px">Decrypting…</div></div>
    <div class="dialog__foot"><button type="button" class="btn btn--ghost" data-dialog-close>Close</button></div>
  </div>
</div>

<script>
(function () {
  const clients = <?= $clientsJson ?>;
  const sel = document.getElementById('renewal_client');
  clients.forEach(c => {
    const o = document.createElement('option');
    o.value = c.id; o.textContent = c.company_name + (c.client_type ? ' · ' + c.client_type : '');
    sel.appendChild(o);
  });

  const back = document.getElementById('renewalShell');
  const form = document.getElementById('renewalForm');
  const title= back.querySelector('[data-rt]');
  const submit= back.querySelector('[data-renewal-submit]');
  const openDialog = (el) => { el.style.display = 'flex'; el.classList.add('is-open'); };
  const closeDialog = (el) => { el.classList.remove('is-open'); el.style.display = 'none'; };
  document.addEventListener('click', (e) => {
    const c = e.target.closest('[data-dialog-close]');
    if (c) { closeDialog(back); closeDialog(document.getElementById('vaultShell')); }
  });

  document.querySelector('[data-renewal-new]').addEventListener('click', () => {
    form.reset(); form.querySelector('[name=id]').value=''; title.textContent='New Renewal'; submit.textContent='Create';
    openDialog(back);
  });
  document.querySelectorAll('[data-renewal-edit]').forEach(b => b.addEventListener('click', () => {
    const d = JSON.parse(b.dataset.renewalEdit);
    form.reset();
    Object.entries(d).forEach(([k,v]) => {
      const el = form.querySelector(`[name="${k}"]`); if (el) el.value = (v==null?'':v);
    });
    title.textContent='Edit Renewal'; submit.textContent='Update';
    openDialog(back);
  }));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submit.disabled=true; const orig=submit.textContent; submit.textContent='Saving…';
    try {
      const fd = new FormData(form);
      const r  = await fetch(form.action,{method:'POST',body:fd,credentials:'same-origin'});
      const j  = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error||'Save failed');
      toast(j.message||'Saved','success');
      setTimeout(()=>location.reload(),300);
    } catch (err) { submit.disabled=false; submit.textContent=orig; toast(err.message,'error'); }
  });

  document.querySelectorAll('[data-renewal-delete]').forEach(b => b.addEventListener('click', () => {
    const id=b.dataset.renewalDelete, domain=b.dataset.domain;
    openDeleteConfirm({
      title:'Delete this renewal?',
      message:`Permanently delete the renewal entry for "${domain}". Cannot be undone.`,
      typeWord:'DELETE',
      onConfirm: async () => {
        const j = await postJSON('/app/actions/renewals.php',{action:'delete',id});
        if (!j.ok) throw new Error(j.error||'Delete failed');
        toast('Deleted','success'); setTimeout(()=>location.reload(),250);
      },
    });
  }));

  document.querySelectorAll('[data-trigger]').forEach(b => b.addEventListener('click', async () => {
    const id=b.dataset.trigger, disabled=b.dataset.disabled==='1', domain=b.dataset.domain;
    const turnOff = !disabled;
    if (turnOff && !confirm(`Disable email triggers? No automatic renewal reminders (client or internal CC) will be sent for ${domain} until you re-enable.`)) return;
    try {
      const j = await postJSON('/app/actions/renewals.php',{action:'toggle_triggers',id,disabled:turnOff?1:0});
      if (!j.ok) throw new Error(j.error||'Update failed');
      toast(turnOff?'Email triggers disabled':'Email triggers re-enabled','success');
      setTimeout(()=>location.reload(),250);
    } catch (err) { toast(err.message,'error'); }
  }));

  // Vault viewer
  const vault = document.getElementById('vaultShell');
  document.querySelectorAll('[data-vault]').forEach(b => b.addEventListener('click', async () => {
    document.getElementById('vaultBody').innerHTML = '<div style="text-align:center;color:var(--muted-foreground);padding:32px">Decrypting…</div>';
    openDialog(vault);
    try {
      const j = await postJSON('/app/actions/renewals.php',{action:'get_creds',id:b.dataset.vault});
      if (!j.ok) throw new Error(j.error||'Failed');
      const items = [['Panel',j.data.panel_type],['Admin URL',j.data.admin_url],['Username',j.data.username],['Password',j.data.password,true],['FTP Host',j.data.ftp_host],['FTP Port',j.data.ftp_port],['FTP Username',j.data.ftp_username],['FTP Password',j.data.ftp_password,true]];
      let html = '<div style="display:flex;justify-content:flex-end;margin-bottom:8px"><button type="button" class="btn btn--ghost btn--sm" data-vault-reveal>Reveal</button></div>';
      items.forEach(([lbl,val,secret]) => {
        const v = val ? (secret ? '<span data-secret="'+encodeURIComponent(val)+'">••••••••</span>' : String(val).replace(/&/g,'&amp;').replace(/</g,'&lt;')) : '—';
        html += `<div style="display:flex;justify-content:space-between;align-items:center;border:1px solid var(--border);background:var(--muted);border-radius:8px;padding:8px 12px;margin-bottom:6px"><div style="min-width:0"><div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted-foreground)">${lbl}</div><div style="font-family:ui-monospace,monospace;word-break:break-all" data-val>${v}</div></div>${val?'<button type="button" class="icon-btn" data-copy="'+encodeURIComponent(val)+'" title="Copy"><svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><rect x=\\'9\\' y=\\'9\\' width=\\'13\\' height=\\'13\\' rx=\\'2\\'/><path d=\\'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1\\'/></svg></button>':''}</div>`;
      });
      document.getElementById('vaultBody').innerHTML = html;
      let revealed = false;
      document.querySelector('[data-vault-reveal]')?.addEventListener('click', (ev) => {
        revealed = !revealed; ev.target.textContent = revealed ? 'Hide' : 'Reveal';
        document.querySelectorAll('[data-secret]').forEach(s => {
          s.textContent = revealed ? decodeURIComponent(s.dataset.secret) : '••••••••';
        });
      });
      document.querySelectorAll('[data-copy]').forEach(c => c.addEventListener('click', () => {
        navigator.clipboard.writeText(decodeURIComponent(c.dataset.copy)); toast('Copied','success');
      }));
    } catch (err) {
      document.getElementById('vaultBody').innerHTML = '<div style="color:var(--destructive);padding:24px">'+err.message+'</div>';
    }
  }));
})();
</script>

<?php require __DIR__ . '/../includes/layout_footer.php'; ?>
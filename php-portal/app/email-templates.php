<?php
require __DIR__ . '/../includes/bootstrap.php';
require_super_admin();
$page_title = 'Email Templates';

$rows = db_all('SELECT * FROM email_templates ORDER BY template_key');
$activeId = (string)($_GET['t'] ?? ($rows[0]['id'] ?? ''));
$active = null; foreach ($rows as $r) if ($r['id'] === $activeId) { $active = $r; break; }

$labels = [
  'renewal_30'      => 'Renewal — 30 days before expiry',
  'renewal_7'       => 'Renewal — 7 days before expiry',
  'renewal_1'       => 'Renewal — 1 day before expiry',
  'renewal_expired' => 'Renewal — Already expired',
  'amc_expired'     => 'AMC — Already expired',
];
$labelFor = function(string $k) use ($labels): string {
    if (isset($labels[$k])) return $labels[$k];
    if (preg_match('/^renewal_(\d+)$/', $k, $m)) return "Renewal — {$m[1]} days before expiry";
    if (preg_match('/^amc_hours_(\d+)$/', $k, $m)) return "AMC — {$m[1]}% hours consumed";
    if (preg_match('/^amc_expiry_(\d+)$/', $k, $m)) return "AMC — {$m[1]} days before expiry";
    return $k;
};

$variables = ['{{client_name}}','{{domain}}','{{expiry_kind}}','{{expiry_date}}','{{days_left}}','{{contact_person}}','{{usage_pct}}','{{allocated_hours}}','{{used_hours}}','{{remaining_hours}}','{{end_date}}','{{days_overdue}}','{{service_name}}','{{cycle_month}}'];

require __DIR__ . '/../includes/layout_header.php';
?>
<?php render_page_header('Email Templates', 'Customize the HTML reminders sent automatically at every configured threshold and after expiry.'); ?>

<div style="display:grid;grid-template-columns:1fr;gap:24px">
  <div style="display:grid;grid-template-columns:1fr;gap:24px" id="tplLayout">
    <div style="display:flex;flex-direction:column;gap:8px">
      <?php foreach ($rows as $t): ?>
        <a href="?t=<?= e($t['id']) ?>" class="nav-link" style="background:<?= $t['id']===$activeId ? 'rgba(55,86,230,.08)' : 'var(--card)' ?>;color:var(--foreground);border:1px solid <?= $t['id']===$activeId ? 'var(--primary)' : 'var(--border)' ?>;padding:12px 14px;border-radius:10px">
          <?= icon('mail') ?>
          <span>
            <span style="display:block;font-weight:500;font-size:13px;color:var(--foreground)"><?= e($labelFor($t['template_key'])) ?></span>
            <span class="badge" style="margin-top:4px;font-family:ui-monospace,monospace;font-size:10px"><?= e($t['template_key']) ?></span>
          </span>
        </a>
      <?php endforeach; ?>
    </div>

    <div class="card" style="padding:24px">
      <?php if (!$active): ?>
        <div style="color:var(--muted-foreground);text-align:center">Select a template</div>
      <?php else: ?>
        <form id="tplForm" method="post" action="/app/actions/email-templates.php">
          <?= csrf_field() ?>
          <input type="hidden" name="action" value="save">
          <input type="hidden" name="id" value="<?= e($active['id']) ?>">
          <div class="field"><label class="field__label">Subject Line</label>
            <input type="text" name="subject" value="<?= e($active['subject']) ?>">
          </div>
          <div class="field"><label class="field__label">HTML Body</label>
            <textarea name="html_body" rows="16" style="font-family:ui-monospace,monospace;font-size:12px"><?= e($active['html_body']) ?></textarea>
          </div>
          <div style="border-radius:10px;background:var(--muted);padding:12px">
            <div style="font-size:11px;font-weight:600;color:var(--muted-foreground);margin-bottom:6px">Available variables (click to insert)</div>
            <div>
              <?php foreach ($variables as $v): ?>
                <button type="button" class="var-chip" data-var="<?= e($v) ?>"><?= e($v) ?></button>
              <?php endforeach; ?>
            </div>
          </div>
          <div style="display:flex;justify-content:flex-end;margin-top:14px">
            <button type="submit" class="btn btn--gradient" data-tpl-submit>Save Template</button>
          </div>
        </form>
      <?php endif; ?>
    </div>
  </div>
</div>
<style>@media(min-width:1024px){#tplLayout{grid-template-columns:300px 1fr}}</style>
<script>
(function(){
  const ta = document.querySelector('textarea[name=html_body]');
  document.querySelectorAll('.var-chip').forEach(b => b.addEventListener('click', () => {
    if (!ta) return; const v=b.dataset.var; const s=ta.selectionStart,e=ta.selectionEnd;
    ta.value = ta.value.slice(0,s) + v + ta.value.slice(e); ta.focus(); ta.selectionStart=ta.selectionEnd=s+v.length;
  }));
  const form=document.getElementById('tplForm'); if (!form) return;
  const submit=form.querySelector('[data-tpl-submit]');
  form.addEventListener('submit', async e=>{
    e.preventDefault(); submit.disabled=true; const orig=submit.textContent; submit.textContent='Saving…';
    try{const fd=new FormData(form); const r=await fetch(form.action,{method:'POST',body:fd,credentials:'same-origin'}); const j=await r.json();
      if(!r.ok||!j.ok) throw new Error(j.error||'Save failed'); toast('Template saved','success');
    } catch(err){toast(err.message,'error');} finally{submit.disabled=false;submit.textContent=orig;}
  });
})();
</script>
<?php require __DIR__ . '/../includes/layout_footer.php'; ?>
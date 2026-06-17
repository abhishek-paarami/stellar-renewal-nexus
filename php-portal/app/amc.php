<?php
require __DIR__ . '/../includes/bootstrap.php';
$user = require_login(); $isSA = is_super_admin();
$page_title = 'AMC Clients';

$q    = trim((string)($_GET['q'] ?? ''));
$sort = (string)($_GET['sort'] ?? 'expiry_asc');

$rows = db_all('SELECT a.*, c.company_name FROM amc_clients a LEFT JOIN clients c ON c.id = a.client_id');
$rows = array_values(array_filter($rows, function ($r) use ($q) {
    if ($q === '') return true;
    $blob = strtolower(($r['company_name'] ?? '') . ' ' . ($r['website'] ?? '') . ' ' . ($r['bd_person'] ?? ''));
    return str_contains($blob, strtolower($q));
}));
usort($rows, function ($a, $b) use ($sort) {
    $cn = fn($r) => strtolower($r['company_name'] ?? '');
    if ($sort === 'az') return strcmp($cn($a), $cn($b));
    if ($sort === 'za') return strcmp($cn($b), $cn($a));
    if ($sort === 'hours_asc') return (float)$a['consumed_hours'] <=> (float)$b['consumed_hours'];
    if ($sort === 'hours_desc') return (float)$b['consumed_hours'] <=> (float)$a['consumed_hours'];
    $ea = $a['end_date'] ?? ''; $eb = $b['end_date'] ?? '';
    return $sort === 'expiry_asc' ? strcmp($ea, $eb) : strcmp($eb, $ea);
});

$clients = db_all('SELECT id, company_name FROM clients ORDER BY company_name');
$bd      = db_all("SELECT id, name FROM bd_persons WHERE is_active = 1 ORDER BY name");
$existingClientIds = array_values(array_filter(array_column($rows, 'client_id')));

require __DIR__ . '/../includes/layout_header.php';
?>
<?php render_page_header('AMC Clients', 'Annual Maintenance Contracts with hour tracking & expiry alerts.',
    '<button type="button" class="btn btn--gradient" data-amc-new>' . icon('wrench') . ' New AMC</button>'
); ?>

<form method="get" class="toolbar">
  <div class="toolbar__search">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
    <input type="text" name="q" value="<?= e($q) ?>" placeholder="Search client, website, BD..." autocomplete="off">
  </div>
  <select class="select" name="sort" onchange="this.form.submit()">
    <?php foreach ([
      'expiry_asc'=>'Expiry: soonest first','expiry_desc'=>'Expiry: latest first',
      'az'=>'Client: A → Z','za'=>'Client: Z → A',
      'hours_asc'=>'Hours consumed: low → high','hours_desc'=>'Hours consumed: high → low',
    ] as $k=>$lbl): ?>
      <option value="<?= $k ?>"<?= $sort===$k?' selected':'' ?>><?= e($lbl) ?></option>
    <?php endforeach; ?>
  </select>
  <span class="badge"><?= count($rows) ?> AMCs</span>
</form>

<?php if (!$rows): ?>
  <div class="table-card"><div class="empty">
    <div class="empty__icon"><?= icon('wrench') ?></div>
    <p class="empty__t">No AMC clients yet</p>
    <p class="empty__d">Add an AMC to start tracking hours.</p>
  </div></div>
<?php else: ?>
  <div class="card-grid">
  <?php foreach ($rows as $r):
    $used=(float)$r['consumed_hours']; $total=(float)$r['allocated_hours'];
    $pct = $total>0 ? min(100, (int)round($used/$total*100)) : 0;
    $remaining = max(0,$total-$used);
    $expDays = days_until($r['end_date']);
    $expBadge = $expDays===null ? 'badge--muted' : ($expDays<0?'badge--danger':($expDays<=7?'badge--danger':($expDays<=30?'badge--warning':'badge--success')));
    $expLbl = $expDays===null ? '—' : ($expDays<0 ? 'Expired '.abs($expDays).'d ago' : $expDays.'d left');
    $pctBadge = $pct>=100?'badge--danger':($pct>=85?'badge--danger':($pct>=55?'badge--warning':'badge--success'));
    $barCls = $pct>80?'progress__bar--danger':($pct>60?'progress__bar--warning':'');
    $data = [
      'id'=>$r['id'],'client_id'=>(string)($r['client_id']??''),'website'=>$r['website']??'','bd_person'=>$r['bd_person']??'',
      'start_date'=>$r['start_date']??'','end_date'=>$r['end_date']??'',
      'allocated_hours'=>$r['allocated_hours']??'','notes'=>$r['notes']??'',
      'is_active'=>(int)($r['is_active'] ?? 1),
      'notify_emails'=>implode(', ', from_json_col($r['notify_emails'] ?? '[]', [])),
    ];
  ?>
    <div class="amc-card">
      <div class="amc-card__hd">
        <div style="min-width:0">
          <h3 class="amc-card__title"><?= e($r['company_name'] ?? '—') ?></h3>
          <?php if ($r['website']): ?><div class="amc-card__sub"><?= e($r['website']) ?></div><?php endif; ?>
        </div>
        <div class="row-actions">
          <button type="button" class="icon-btn" title="Edit" data-amc-edit='<?= e(json_encode($data, JSON_UNESCAPED_UNICODE)) ?>'>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/></svg>
          </button>
          <?php if ($isSA): ?>
            <button type="button" class="icon-btn icon-btn--danger" title="Delete" data-amc-delete="<?= e($r['id']) ?>" data-name="<?= e($r['company_name'] ?? '') ?>">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6 17.4 20.2A2 2 0 0 1 15.4 22H8.6a2 2 0 0 1-2-1.8L5 6"/></svg>
            </button>
          <?php endif; ?>
        </div>
      </div>
      <div class="amc-card__body">
        <div>
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted-foreground);margin-bottom:4px">
            <span>Hours used</span>
            <span style="font-weight:500;color:<?= $remaining/max($total,1) <= 0.2 ? 'var(--destructive)' : 'var(--foreground)' ?>"><?= number_format($used,1) ?> / <?= number_format($total,1) ?>h</span>
          </div>
          <div class="progress"><div class="progress__bar <?= $barCls ?>" style="width:<?= $pct ?>%"></div></div>
          <div style="margin-top:4px;font-size:10px;color:var(--muted-foreground)"><?= number_format($remaining,1) ?>h remaining</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr auto;gap:12px;font-size:12px">
          <div>
            <div style="color:var(--muted-foreground)">Period</div>
            <div style="margin-top:2px;font-weight:500"><?= e(format_date($r['start_date'])) ?> → <?= e(format_date($r['end_date'])) ?></div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
            <span class="badge <?= $expBadge ?>"><?= e($expLbl) ?></span>
            <span class="badge <?= $pctBadge ?>" style="font-weight:600"><?= $pct ?>% used</span>
          </div>
        </div>
        <?php if ($r['bd_person']): ?><div style="font-size:11px;color:var(--muted-foreground)">BD: <?= e($r['bd_person']) ?></div><?php endif; ?>
      </div>
      <?php if ($isSA): ?>
      <div class="amc-card__foot">
        <span>Email triggers: <b style="color:<?= !empty($r['triggers_disabled']) ? 'var(--destructive)' : 'var(--success)' ?>"><?= !empty($r['triggers_disabled']) ? 'DISABLED' : 'Active' ?></b></span>
        <button type="button" class="btn btn--ghost btn--sm" data-amc-toggle="<?= e($r['id']) ?>" data-disabled="<?= (int)!empty($r['triggers_disabled']) ?>" data-name="<?= e($r['company_name'] ?? '') ?>">
          <?= !empty($r['triggers_disabled']) ? 'Enable' : 'Disable' ?> triggers
        </button>
      </div>
      <?php endif; ?>
    </div>
  <?php endforeach; ?>
  </div>
<?php endif; ?>

<!-- ====== AMC dialog ====== -->
<div class="dialog-back" id="amcShell">
  <div class="dialog dialog--md" role="dialog" aria-modal="true">
    <div class="dialog__head">
      <h3 class="dialog__title" data-at>New AMC</h3>
      <p class="dialog__sub">Annual contract with allocated support hours.</p>
    </div>
    <form id="amcForm" class="dialog__body" method="post" action="/app/actions/amc.php">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="upsert">
      <input type="hidden" name="id" value="">
      <div class="form-grid">
        <div class="field col-2"><label class="field__label">Client <span class="req">*</span></label>
          <select name="client_id" required>
            <option value="">— Select client —</option>
            <?php $taken = array_flip($existingClientIds); foreach ($clients as $c): ?>
              <option value="<?= e($c['id']) ?>" data-taken="<?= isset($taken[$c['id']])?1:0 ?>"><?= e($c['company_name']) ?></option>
            <?php endforeach; ?>
          </select>
        </div>
        <div class="field"><label class="field__label">Website</label><input type="text" name="website"></div>
        <div class="field"><label class="field__label">BD Person</label>
          <select name="bd_person"><option value="">— Select BD —</option>
            <?php foreach ($bd as $b): ?><option value="<?= e($b['name']) ?>"><?= e($b['name']) ?></option><?php endforeach; ?>
          </select>
        </div>
        <div class="field"><label class="field__label">Start Date <span class="req">*</span></label><input type="date" name="start_date" required></div>
        <div class="field"><label class="field__label">End Date <span class="req">*</span></label><input type="date" name="end_date" required></div>
        <div class="field col-2"><label class="field__label">Allocated Hours <span class="req">*</span></label><input type="number" step="0.5" name="allocated_hours" required></div>
        <div class="field col-2"><label class="field__label">Notification Emails</label>
          <input type="text" name="notify_emails" placeholder="ops@client.com, manager@client.com">
          <div class="field__hint">Comma-separated. We auto-send alerts at the configured % usage thresholds.</div>
        </div>
        <div class="field col-2"><label class="field__label">Notes</label><textarea name="notes" rows="3"></textarea></div>
      </div>
    </form>
    <div class="dialog__foot">
      <button type="button" class="btn btn--ghost" data-dialog-close>Cancel</button>
      <button type="submit" form="amcForm" class="btn btn--gradient" data-amc-submit>Create</button>
    </div>
  </div>
</div>

<script>
(function(){
  const back = document.getElementById('amcShell');
  const form = document.getElementById('amcForm');
  const title= back.querySelector('[data-at]');
  const submit= back.querySelector('[data-amc-submit]');
  const open = ()=>{back.style.display='flex';back.classList.add('is-open');};
  const close= ()=>{back.classList.remove('is-open');back.style.display='none';};
  document.addEventListener('click', e => { if (e.target.closest('[data-dialog-close]') || e.target===back) close(); });

  document.querySelector('[data-amc-new]').addEventListener('click', ()=>{
    form.reset(); form.querySelector('[name=id]').value='';
    title.textContent='New AMC'; submit.textContent='Create';
    form.querySelectorAll('[name=client_id] option').forEach(o=>{ o.disabled = o.dataset.taken==='1'; });
    open();
  });
  document.querySelectorAll('[data-amc-edit]').forEach(b=>b.addEventListener('click',()=>{
    const d = JSON.parse(b.dataset.amcEdit);
    form.reset();
    Object.entries(d).forEach(([k,v])=>{
      const el=form.querySelector(`[name="${k}"]`); if(el) el.value=(v==null?'':v);
    });
    form.querySelectorAll('[name=client_id] option').forEach(o=>{
      o.disabled = o.dataset.taken==='1' && o.value !== d.client_id;
    });
    title.textContent='Edit AMC'; submit.textContent='Update'; open();
  }));
  form.addEventListener('submit', async e=>{
    e.preventDefault(); submit.disabled=true; const orig=submit.textContent; submit.textContent='Saving…';
    try {
      const fd = new FormData(form);
      const r = await fetch(form.action,{method:'POST',body:fd,credentials:'same-origin'});
      const j = await r.json();
      if(!r.ok||!j.ok) throw new Error(j.error||'Save failed');
      toast(j.message||'Saved','success'); setTimeout(()=>location.reload(),250);
    } catch (err){ submit.disabled=false; submit.textContent=orig; toast(err.message,'error'); }
  });

  document.querySelectorAll('[data-amc-delete]').forEach(b=>b.addEventListener('click',()=>{
    const id=b.dataset.amcDelete, name=b.dataset.name;
    openDeleteConfirm({title:'Delete this AMC?',message:`Permanently delete the AMC for "${name}" and all linked time entries.`,typeWord:'DELETE',
      onConfirm: async()=>{const j=await postJSON('/app/actions/amc.php',{action:'delete',id});if(!j.ok) throw new Error(j.error||'Delete failed');toast('AMC deleted','success');setTimeout(()=>location.reload(),250);}
    });
  }));
  document.querySelectorAll('[data-amc-toggle]').forEach(b=>b.addEventListener('click',async ()=>{
    const id=b.dataset.amcToggle, dis=b.dataset.disabled==='1', name=b.dataset.name;
    const off=!dis;
    if (off && !confirm(`Disable email triggers? No automatic emails will be sent for ${name} until you re-enable.`)) return;
    try{const j=await postJSON('/app/actions/amc.php',{action:'toggle_triggers',id,disabled:off?1:0});if(!j.ok) throw new Error(j.error||'Failed');toast(off?'Email triggers disabled':'Email triggers re-enabled','success');setTimeout(()=>location.reload(),250);}
    catch(err){toast(err.message,'error');}
  }));
})();
</script>
<?php require __DIR__ . '/../includes/layout_footer.php'; ?>
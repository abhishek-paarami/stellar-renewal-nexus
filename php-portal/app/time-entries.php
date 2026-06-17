<?php
require __DIR__ . '/../includes/bootstrap.php';
require_login();
$page_title = 'Time Entries';

$q = trim((string)($_GET['q'] ?? ''));
$amcTab = (string)($_GET['amc'] ?? 'all');

$entries = db_all('SELECT te.*, a.website AS amc_website, c.company_name FROM time_entries te
                   LEFT JOIN amc_clients a ON a.id = te.amc_client_id
                   LEFT JOIN clients c ON c.id = a.client_id
                   ORDER BY entry_date DESC');
$amcs = db_all('SELECT a.id, a.website, c.company_name AS client_name FROM amc_clients a LEFT JOIN clients c ON c.id = a.client_id');
$clients = db_all('SELECT id, company_name FROM clients');
$devs = db_all("SELECT id, name FROM developers WHERE is_active = 1 ORDER BY name");

$amcLabel = function($id) use ($amcs) {
    foreach ($amcs as $a) if ($a['id'] === $id) return ($a['client_name'] ?? 'Unknown') . ($a['website'] ? ' · ' . $a['website'] : '');
    return '—';
};

$entries = array_values(array_filter($entries, function ($r) use ($q, $amcTab, $amcLabel) {
    if ($amcTab !== 'all' && $r['amc_client_id'] !== $amcTab) return false;
    if ($q === '') return true;
    $blob = strtolower($amcLabel($r['amc_client_id']) . ' ' . $r['developer_name'] . ' ' . $r['work_description']);
    return str_contains($blob, strtolower($q));
}));

$usedAmcIds = array_values(array_unique(array_filter(array_column($entries, 'amc_client_id'))));
$totalHours = 0; foreach ($entries as $r) $totalHours += (int)$r['hours'] + (int)$r['minutes']/60;

require __DIR__ . '/../includes/layout_header.php';
?>
<?php render_page_header('Time Entries', 'Log developer hours against AMC contracts. Approved entries auto-deduct allocated hours.',
    '<button type="button" class="btn btn--gradient" data-te-new>' . icon('clock') . ' Log Time</button>'
); ?>

<form method="get" class="toolbar">
  <div class="toolbar__search">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
    <input type="text" name="q" value="<?= e($q) ?>" placeholder="Search AMC, developer, work..." autocomplete="off">
  </div>
  <input type="hidden" name="amc" value="<?= e($amcTab) ?>">
  <span class="badge"><?= count($entries) ?> entries · <?= number_format($totalHours,2) ?>h</span>
</form>

<div class="tabs" style="margin-bottom:14px">
  <a href="?amc=all<?= $q ? '&q='.urlencode($q) : '' ?>" class="tabs__btn<?= $amcTab==='all'?' is-active':'' ?>">All</a>
  <?php foreach ($usedAmcIds as $id): ?>
    <a href="?amc=<?= urlencode($id) ?><?= $q ? '&q='.urlencode($q) : '' ?>" class="tabs__btn<?= $amcTab===$id?' is-active':'' ?>"><?= e($amcLabel($id)) ?></a>
  <?php endforeach; ?>
</div>

<?php if (!$entries): ?>
  <div class="table-card"><div class="empty">
    <div class="empty__icon"><?= icon('clock') ?></div>
    <p class="empty__t">No time entries</p>
    <p class="empty__d">Log work against AMCs to track hour consumption.</p>
  </div></div>
<?php else: ?>
  <div class="table-card"><div style="overflow-x:auto"><table class="table">
    <thead><tr><th>Date</th><th>AMC</th><th>Developer</th><th>Work</th><th style="text-align:right">Time</th><th>Status</th><th style="text-align:right">Actions</th></tr></thead>
    <tbody>
    <?php foreach ($entries as $r):
      $st = $r['status']; $sBadge = $st==='approved'?'badge--success':($st==='rejected'?'badge--danger':'badge--warning');
      $data = [
        'id'=>$r['id'],'amc_client_id'=>$r['amc_client_id'],'developer_name'=>$r['developer_name'],
        'entry_date'=>$r['entry_date'],'work_description'=>$r['work_description'],
        'hours'=>(int)$r['hours'],'minutes'=>(int)$r['minutes'],
        'is_billable'=>(int)$r['is_billable'],'status'=>$st,
      ];
    ?>
      <tr>
        <td style="font-size:12px"><?= e(format_date($r['entry_date'])) ?></td>
        <td style="font-size:12px"><?= e($amcLabel($r['amc_client_id'])) ?></td>
        <td><b><?= e($r['developer_name']) ?></b></td>
        <td style="color:var(--muted-foreground);max-width:24rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><?= e($r['work_description']) ?></td>
        <td style="text-align:right;font-family:ui-monospace,monospace;font-size:12px"><?= (int)$r['hours'] ?>h <?= (int)$r['minutes'] ?>m</td>
        <td><span class="badge <?= $sBadge ?>"><?= e($st) ?></span></td>
        <td style="text-align:right">
          <div class="row-actions">
            <button type="button" class="icon-btn" title="Edit" data-te-edit='<?= e(json_encode($data, JSON_UNESCAPED_UNICODE)) ?>'>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/></svg>
            </button>
            <button type="button" class="icon-btn icon-btn--danger" title="Delete" data-te-delete="<?= e($r['id']) ?>" data-info="<?= e($r['developer_name'].' · '.$r['hours'].'h '.$r['minutes'].'m') ?>">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6 17.4 20.2A2 2 0 0 1 15.4 22H8.6a2 2 0 0 1-2-1.8L5 6"/></svg>
            </button>
          </div>
        </td>
      </tr>
    <?php endforeach; ?>
    </tbody></table></div></div>
<?php endif; ?>

<div class="dialog-back" id="teShell">
  <div class="dialog dialog--md" role="dialog" aria-modal="true">
    <div class="dialog__head"><h3 class="dialog__title" data-tt>Log Time</h3><p class="dialog__sub">Approved entries deduct hours from the AMC.</p></div>
    <form id="teForm" class="dialog__body" method="post" action="/app/actions/time-entries.php">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="upsert">
      <input type="hidden" name="id" value="">
      <div class="form-grid">
        <div class="field col-2"><label class="field__label">AMC Client <span class="req">*</span></label>
          <select name="amc_client_id" required>
            <option value="">— Select AMC —</option>
            <?php foreach ($amcs as $a): ?>
              <option value="<?= e($a['id']) ?>"><?= e(($a['client_name'] ?? 'Unknown') . ($a['website'] ? ' · '.$a['website'] : '')) ?></option>
            <?php endforeach; ?>
          </select>
        </div>
        <div class="field"><label class="field__label">Date <span class="req">*</span></label><input type="date" name="entry_date" value="<?= e(date('Y-m-d')) ?>" required></div>
        <div class="field"><label class="field__label">Developer <span class="req">*</span></label>
          <select name="developer_name" required>
            <option value="">— Select developer —</option>
            <?php foreach ($devs as $d): ?><option value="<?= e($d['name']) ?>"><?= e($d['name']) ?></option><?php endforeach; ?>
          </select>
        </div>
        <div class="field"><label class="field__label">Hours</label><input type="number" min="0" name="hours" value="0"></div>
        <div class="field"><label class="field__label">Minutes</label><input type="number" min="0" max="59" name="minutes" value="0"></div>
        <div class="field"><label class="field__label">Status</label>
          <select name="status"><option value="pending">Pending</option><option value="approved" selected>Approved</option><option value="rejected">Rejected</option></select>
        </div>
        <div class="field" style="flex-direction:row;align-items:center;gap:8px;padding-top:24px"><input type="checkbox" name="is_billable" value="1" id="billable" checked><label for="billable" class="field__label" style="margin:0">Billable</label></div>
        <div class="field col-2"><label class="field__label">Work Description <span class="req">*</span></label><textarea name="work_description" rows="4" required></textarea></div>
      </div>
    </form>
    <div class="dialog__foot">
      <button type="button" class="btn btn--ghost" data-dialog-close>Cancel</button>
      <button type="submit" form="teForm" class="btn btn--gradient" data-te-submit>Log</button>
    </div>
  </div>
</div>

<script>
(function(){
  const back=document.getElementById('teShell'), form=document.getElementById('teForm');
  const title=back.querySelector('[data-tt]'), submit=back.querySelector('[data-te-submit]');
  const open=()=>{back.style.display='flex';back.classList.add('is-open');};
  const close=()=>{back.classList.remove('is-open');back.style.display='none';};
  document.addEventListener('click', e=>{ if (e.target.closest('[data-dialog-close]') || e.target===back) close(); });

  document.querySelector('[data-te-new]').addEventListener('click',()=>{
    form.reset(); form.querySelector('[name=id]').value=''; form.querySelector('[name=entry_date]').value=new Date().toISOString().slice(0,10);
    form.querySelector('[name=is_billable]').checked=true; form.querySelector('[name=status]').value='approved';
    title.textContent='Log Time'; submit.textContent='Log'; open();
  });
  document.querySelectorAll('[data-te-edit]').forEach(b=>b.addEventListener('click',()=>{
    const d=JSON.parse(b.dataset.teEdit); form.reset();
    Object.entries(d).forEach(([k,v])=>{const el=form.querySelector(`[name="${k}"]`);if(!el)return;if(el.type==='checkbox')el.checked=!!v;else el.value=(v==null?'':v);});
    title.textContent='Edit Time Entry'; submit.textContent='Update'; open();
  }));
  form.addEventListener('submit', async e=>{
    e.preventDefault(); submit.disabled=true; const orig=submit.textContent; submit.textContent='Saving…';
    try{const fd=new FormData(form); if(!fd.has('is_billable')) fd.append('is_billable','0');
      const r=await fetch(form.action,{method:'POST',body:fd,credentials:'same-origin'}); const j=await r.json();
      if(!r.ok||!j.ok) throw new Error(j.error||'Save failed');
      toast(j.message||'Saved','success'); setTimeout(()=>location.reload(),250);
    } catch(err){submit.disabled=false;submit.textContent=orig;toast(err.message,'error');}
  });
  document.querySelectorAll('[data-te-delete]').forEach(b=>b.addEventListener('click',()=>{
    const id=b.dataset.teDelete, info=b.dataset.info;
    openDeleteConfirm({title:'Delete this time entry?',message:`Permanently delete the time entry for ${info}.`,typeWord:'DELETE',
      onConfirm: async()=>{const j=await postJSON('/app/actions/time-entries.php',{action:'delete',id});if(!j.ok) throw new Error(j.error||'Delete failed');toast('Deleted','success');setTimeout(()=>location.reload(),250);}});
  }));
})();
</script>
<?php require __DIR__ . '/../includes/layout_footer.php'; ?>
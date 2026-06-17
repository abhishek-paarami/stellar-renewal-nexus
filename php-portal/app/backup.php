<?php
require __DIR__ . '/../includes/bootstrap.php';
$me = require_super_admin();
$page_title = 'Database Backup & Restore';
require __DIR__ . '/../../includes/layout_header.php';
?>
<?php render_page_header('Database Backup & Restore', 'Full JSON snapshot of every portal table. Super Admin only.'); ?>

<div style="border-radius:10px;border:1px solid color-mix(in oklab, var(--destructive) 30%, transparent);background:color-mix(in oklab, var(--destructive) 6%, transparent);padding:14px 16px;margin-bottom:18px;display:flex;gap:12px">
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="var(--destructive)" stroke-width="2"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
  <div style="font-size:13px">
    <div style="font-weight:600;color:var(--destructive)">Handle with care</div>
    <div style="color:var(--muted-foreground);margin-top:4px">
      The backup contains <b>all portal data</b> including encrypted credential blobs. Store it securely.
      Restoring in <b>Replace</b> mode wipes existing rows in every table (except <code>user_profiles</code> and <code>app_settings</code>) and re-inserts the snapshot. Use <b>Merge</b> to upsert without deleting.
    </div>
  </div>
</div>

<div style="display:grid;grid-template-columns:1fr;gap:16px" id="bkGrid">
  <div class="card" style="padding:18px">
    <div style="font-weight:600;display:flex;align-items:center;gap:8px;margin-bottom:4px"><?= icon('db') ?> Export</div>
    <div style="color:var(--muted-foreground);font-size:13px;margin-bottom:12px">Download a complete JSON backup of every table.</div>
    <button type="button" class="btn btn--gradient" id="btnExport"><?= icon('sheet') ?> Download backup</button>
  </div>
  <div class="card" style="padding:18px">
    <div style="font-weight:600;display:flex;align-items:center;gap:8px;margin-bottom:4px"><?= icon('refresh') ?> Restore</div>
    <div style="color:var(--muted-foreground);font-size:13px;margin-bottom:12px">Pick a previously-downloaded JSON backup.</div>
    <input type="file" id="bkFile" accept="application/json,.json" style="display:none">
    <div style="display:flex;flex-wrap:wrap;gap:8px">
      <button type="button" class="btn" style="background:var(--destructive);color:#fff" id="btnReplace">Restore (Replace)</button>
      <button type="button" class="btn btn--ghost" id="btnMerge">Restore (Merge / Upsert)</button>
    </div>
    <div style="font-size:11px;color:var(--muted-foreground);margin-top:10px">Replace wipes existing rows. Merge keeps current data and upserts by primary key.</div>
  </div>
</div>
<style>@media(min-width:768px){#bkGrid{grid-template-columns:1fr 1fr}}</style>

<div class="card" id="reportCard" style="padding:18px;margin-top:18px;display:none">
  <div style="font-weight:600;margin-bottom:10px;display:flex;align-items:center;gap:8px"><?= icon('db') ?> Last restore report</div>
  <div style="overflow-x:auto"><table class="table">
    <thead><tr><th>Table</th><th style="text-align:right">Inserted</th><th style="text-align:right">Deleted</th><th>Status</th></tr></thead>
    <tbody id="reportBody"></tbody>
  </table></div>
</div>

<script>
(function(){
  document.getElementById('btnExport').addEventListener('click', async () => {
    const btn = document.getElementById('btnExport'); btn.disabled=true; const o=btn.textContent; btn.textContent='Exporting…';
    try {
      const r = await fetch('/app/actions/backup.php?action=export', {credentials:'same-origin'});
      if (!r.ok) throw new Error('Export failed');
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
      a.href=url; a.download=`paarami-backup-${stamp}.json`; a.click();
      URL.revokeObjectURL(url);
      toast('Backup downloaded','success');
    } catch(err){ toast(err.message,'error'); }
    finally { btn.disabled=false; btn.textContent=o; }
  });

  let mode = 'replace';
  const fileEl = document.getElementById('bkFile');
  const choose = m => { mode = m; fileEl.value=''; fileEl.click(); };
  document.getElementById('btnReplace').addEventListener('click', () => choose('replace'));
  document.getElementById('btnMerge').addEventListener('click', () => choose('merge'));

  fileEl.addEventListener('change', async () => {
    const f = fileEl.files?.[0]; if (!f) return;
    let parsed;
    try {
      parsed = JSON.parse(await f.text());
      if (!parsed.tables) throw new Error("Missing 'tables' object");
    } catch(err){ return toast('Invalid backup file: '+err.message,'error'); }
    const tables = Object.keys(parsed.tables).length;
    const rows = Object.values(parsed.tables).reduce((s,a)=>s+(Array.isArray(a)?a.length:0),0);
    const word = mode==='replace' ? 'REPLACE' : 'MERGE';
    openDeleteConfirm({
      title: mode==='replace' ? 'Replace ENTIRE database?' : 'Merge backup into database?',
      message: `File contains ${tables} tables (${rows} rows). ${mode==='replace' ? 'This will delete every existing row (except user profiles and app settings) and re-insert the snapshot.' : 'Rows will be upserted by primary key.'}`,
      typeWord: word,
      confirmLabel: mode==='replace' ? 'Replace database' : 'Merge data',
      onConfirm: async () => {
        const fd = new FormData();
        fd.append('_csrf', document.querySelector('meta[name="csrf-token"]').content);
        fd.append('action','import');
        fd.append('mode', mode);
        fd.append('data', JSON.stringify(parsed));
        const j = await (await fetch('/app/actions/backup.php',{method:'POST',body:fd,credentials:'same-origin'})).json();
        if (!j.ok) throw new Error(j.error||'Restore failed');
        renderReport(j.report || {});
        toast('Database restored','success');
      },
    });
  });

  function renderReport(rep){
    const card = document.getElementById('reportCard');
    const body = document.getElementById('reportBody');
    body.innerHTML = '';
    Object.entries(rep).forEach(([t,v]) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td style="font-family:ui-monospace,monospace">${t}</td>
        <td style="text-align:right">${v.inserted ?? 0}</td>
        <td style="text-align:right">${v.deleted ?? '—'}</td>
        <td>${v.error ? `<span class="badge badge--danger">${v.error}</span>` : '<span class="badge badge--success">OK</span>'}</td>`;
      body.appendChild(tr);
    });
    card.style.display='block';
  }
})();
</script>
<?php require __DIR__ . '/../../includes/layout_footer.php'; ?>
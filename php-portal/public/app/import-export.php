<?php
require __DIR__ . '/../../includes/bootstrap.php';
$user = require_login(); $isSA = is_super_admin();
$page_title = 'Import / Export';
require __DIR__ . '/../../includes/layout_header.php';
?>
<?php render_page_header('Import / Export',
    $isSA ? 'Bulk import raw data and export anything for backup or reporting.'
          : 'Download per-module spreadsheets. Bulk import is restricted to Super Admin.'); ?>

<div class="tabs" style="margin-bottom:14px">
  <?php if ($isSA): ?><button type="button" class="tabs__btn is-active" data-tab="import">↑ Import</button><?php endif; ?>
  <button type="button" class="tabs__btn<?= $isSA?'':' is-active' ?>" data-tab="export">↓ Export</button>
</div>

<?php if ($isSA): ?>
<section data-pane="import">
  <div class="card" style="padding:22px;margin-bottom:14px">
    <div style="display:flex;gap:14px;align-items:flex-start">
      <div style="width:46px;height:46px;border-radius:12px;background:rgba(55,86,230,.1);color:var(--primary);display:flex;align-items:center;justify-content:center"><?= icon('sheet') ?></div>
      <div style="flex:1">
        <div style="font-weight:600">Smart Excel Import</div>
        <div style="font-size:13px;color:var(--muted-foreground);margin-top:4px">
          Drop one or many .xlsx / .csv files. We'll detect what each file is (Clients, Renewals, AMC, Time Entries) by looking at column headers and route every row to the right table — no mapping needed. Missing clients are created automatically by company name.
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;font-size:11px">
          <span class="badge">Clients · company name</span>
          <span class="badge">Renewals · domain + expiries</span>
          <span class="badge">AMC · start/end + allocated hours</span>
          <span class="badge">Time Entries · developer + hours</span>
        </div>
      </div>
    </div>
    <label for="impFile" style="margin-top:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;border:2px dashed var(--border);border-radius:12px;background:rgba(0,0,0,.02);padding:36px 18px;text-align:center;cursor:pointer">
      <?= icon('sheet') ?>
      <div style="font-size:13px;font-weight:500;margin-top:8px">Click to choose Excel files (or drop them here)</div>
      <div style="font-size:11px;color:var(--muted-foreground);margin-top:4px">.xlsx, .xls, .csv — multiple files supported</div>
      <input id="impFile" type="file" accept=".xlsx,.xls,.csv" multiple style="display:none">
    </label>
  </div>

  <div class="card" id="previewCard" style="padding:20px;display:none">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div style="font-weight:600" id="previewTitle">Preview</div>
      <button type="button" class="btn btn--gradient" id="btnImportAll">↑ Import all</button>
    </div>
    <div id="previewList"></div>
  </div>

  <div class="card" id="resultCard" style="padding:20px;display:none;margin-top:14px">
    <div style="font-weight:600;margin-bottom:10px">Import results</div>
    <div id="resultList"></div>
  </div>
</section>
<?php endif; ?>

<section data-pane="export"<?= $isSA?' style="display:none"':'' ?>>
  <div class="card" style="padding:22px">
    <div style="font-weight:600;margin-bottom:4px">Download spreadsheets</div>
    <div style="font-size:13px;color:var(--muted-foreground);margin-bottom:16px">Each module exports as a single-sheet .xlsx file ready for Excel or Google Sheets.</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">
      <button type="button" class="btn btn--ghost" data-export="clients"><?= icon('users') ?> Clients</button>
      <button type="button" class="btn btn--ghost" data-export="renewals"><?= icon('refresh') ?> Renewals</button>
      <button type="button" class="btn btn--ghost" data-export="amc"><?= icon('wrench') ?> AMC Clients</button>
      <button type="button" class="btn btn--ghost" data-export="time_entries"><?= icon('clock') ?> Time Entries</button>
    </div>
  </div>
</section>

<script src="/assets/js/xlsx.full.min.js"></script>
<script>
(function(){
  // Tab switching
  document.querySelectorAll('.tabs__btn[data-tab]').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.tabs__btn[data-tab]').forEach(x => x.classList.remove('is-active'));
    b.classList.add('is-active');
    document.querySelectorAll('[data-pane]').forEach(p => p.style.display = (p.dataset.pane===b.dataset.tab)?'':'none');
  }));

  const KIND_LABELS = { clients:'Clients', renewals:'Renewals', amc:'AMC Clients', time_entries:'Time Entries' };

  function normalize(h){ return String(h||'').toLowerCase().trim().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,''); }
  function detectKind(headers){
    const h = new Set(headers.map(normalize));
    if (h.has('domain') && (h.has('domain_expiry') || h.has('hosting_expiry') || h.has('ga_expiry'))) return 'renewals';
    if ((h.has('allocated_hours') || h.has('allocated_hrs')) && (h.has('start_date') || h.has('end_date'))) return 'amc';
    if ((h.has('hours') || h.has('hrs') || h.has('duration')) && (h.has('developer') || h.has('developer_name') || h.has('person'))) return 'time_entries';
    if (h.has('company_name') || h.has('company') || h.has('client_name')) return 'clients';
    return 'unknown';
  }

  <?php if ($isSA): ?>
  /* ============ IMPORT ============ */
  const fileInput = document.getElementById('impFile');
  let previews = [];

  fileInput.addEventListener('change', async () => {
    const files = [...(fileInput.files || [])];
    if (!files.length) return;
    previews = [];
    document.getElementById('resultCard').style.display='none';
    for (const f of files) {
      try {
        const buf = await f.arrayBuffer();
        const wb  = XLSX.read(buf, {type:'array', cellDates:true});
        const ws  = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, {defval:null, raw:false});
        const headers = rows.length ? Object.keys(rows[0]) : [];
        previews.push({fileName:f.name, kind:detectKind(headers), headers, rows});
      } catch(err){ toast(`${f.name}: ${err.message||'Read failed'}`,'error'); }
    }
    renderPreviews();
  });

  function renderPreviews(){
    const card = document.getElementById('previewCard');
    const list = document.getElementById('previewList');
    document.getElementById('previewTitle').textContent = `Preview (${previews.length} file${previews.length===1?'':'s'})`;
    list.innerHTML = '';
    previews.forEach(p => {
      const lbl = KIND_LABELS[p.kind] || 'Unknown';
      const cls = p.kind==='unknown' ? 'badge--danger' : 'badge--primary';
      const div = document.createElement('div');
      div.style.cssText='border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:8px';
      const hdrs = p.headers.slice(0,16).map(h => `<span style="background:rgba(0,0,0,.04);padding:2px 8px;border-radius:6px;font-size:11px;color:var(--muted-foreground)">${escapeHtml(h)}</span>`).join(' ');
      const more = p.headers.length>16 ? `<span style="font-size:11px;color:var(--muted-foreground)">+${p.headers.length-16} more</span>` : '';
      div.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div><div style="font-weight:500;font-size:13px">${escapeHtml(p.fileName)}</div>
               <div style="font-size:11px;color:var(--muted-foreground)">${p.rows.length} rows · ${p.headers.length} columns</div></div>
          <span class="badge ${cls}">${lbl}</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px">${hdrs} ${more}</div>`;
      list.appendChild(div);
    });
    card.style.display = previews.length ? 'block' : 'none';
  }

  document.getElementById('btnImportAll').addEventListener('click', async () => {
    if (!previews.length) return;
    const btn = document.getElementById('btnImportAll'); btn.disabled=true; const o=btn.textContent; btn.textContent='Importing…';
    const results = [];
    for (const p of previews) {
      if (p.kind==='unknown'){ results.push({kind:`${p.fileName} (unknown)`, ok:0, failed:p.rows.length, errors:['Could not detect data type from headers']}); continue; }
      try {
        const fd = new FormData();
        fd.append('_csrf', document.querySelector('meta[name=csrf-token]').content);
        fd.append('kind', p.kind);
        fd.append('rows', JSON.stringify(p.rows));
        const j = await (await fetch('/app/actions/import-export.php',{method:'POST',body:fd,credentials:'same-origin'})).json();
        if (!j.ok) throw new Error(j.error||'Import failed');
        results.push({kind:`${p.fileName} → ${KIND_LABELS[p.kind]}`, ok:j.ok_count, failed:j.failed_count, errors:j.errors||[]});
      } catch(err){ results.push({kind:p.fileName, ok:0, failed:p.rows.length, errors:[err.message]}); }
    }
    renderResults(results);
    previews = []; renderPreviews(); fileInput.value='';
    btn.disabled=false; btn.textContent=o;
    const okTot = results.reduce((s,r)=>s+r.ok,0), failTot = results.reduce((s,r)=>s+r.failed,0);
    if (!failTot) toast(`Imported ${okTot} rows successfully`,'success');
    else toast(`Imported ${okTot} rows · ${failTot} failed`,'info');
  });

  function renderResults(rs){
    const card = document.getElementById('resultCard');
    const list = document.getElementById('resultList');
    list.innerHTML = '';
    rs.forEach(r => {
      const ok = r.failed===0;
      const div = document.createElement('div');
      div.style.cssText='border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:8px;display:flex;gap:10px;align-items:flex-start';
      const errs = r.errors.slice(0,3).map(e => `<div style="font-size:11px;color:var(--destructive);margin-top:2px">${escapeHtml(e)}</div>`).join('');
      const moreErr = r.errors.length>3 ? `<div style="font-size:11px;color:var(--muted-foreground)">+${r.errors.length-3} more errors</div>` : '';
      div.innerHTML = `
        <div style="color:${ok?'var(--success,#15803d)':'#d97706'};margin-top:2px">${ok?'✓':'!'}</div>
        <div><div style="font-weight:500;font-size:13px">${escapeHtml(r.kind)}</div>
             <div style="font-size:11px;color:var(--muted-foreground)">${r.ok} imported · ${r.failed} failed</div>${errs}${moreErr}</div>`;
      list.appendChild(div);
    });
    card.style.display = 'block';
  }
  <?php endif; ?>

  /* ============ EXPORT ============ */
  document.querySelectorAll('[data-export]').forEach(btn => btn.addEventListener('click', async () => {
    const kind = btn.dataset.export;
    const o = btn.innerHTML; btn.disabled=true; btn.textContent='Loading…';
    try {
      const r = await fetch(`/app/actions/import-export.php?action=export&kind=${kind}`, {credentials:'same-origin'});
      const j = await r.json();
      if (!j.ok) throw new Error(j.error||'Failed');
      const ws = XLSX.utils.json_to_sheet(j.rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, KIND_LABELS[kind]||kind);
      const stamp = new Date().toISOString().slice(0,10);
      XLSX.writeFile(wb, `paarami-${kind}-${stamp}.xlsx`);
      toast(`Exported ${j.rows.length} ${KIND_LABELS[kind]}`,'success');
    } catch(err){ toast(err.message,'error'); }
    finally { btn.disabled=false; btn.innerHTML=o; }
  }));

  function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
})();
</script>
<?php require __DIR__ . '/../../includes/layout_footer.php'; ?>
<?php
require __DIR__ . '/../includes/bootstrap.php';
$user = require_login();
$page_title = 'Clients';

$q = trim((string)($_GET['q'] ?? ''));
$sql = 'SELECT id, company_name, primary_contact, primary_email, primary_phone, client_type, address, notes, created_at FROM clients';
$params = [];
if ($q !== '') {
    $sql .= ' WHERE company_name LIKE ? OR primary_email LIKE ? OR primary_contact LIKE ?';
    $like = '%' . $q . '%';
    $params = [$like, $like, $like];
}
$sql .= ' ORDER BY created_at DESC';
$rows = db_all($sql, $params);

$editId = $_GET['edit'] ?? null;
$editRow = null;
if ($editId) {
    $editRow = db_one('SELECT * FROM clients WHERE id = ?', [$editId]);
}

require __DIR__ . '/../includes/layout_header.php';
?>
<?php render_page_header(
    'Clients',
    'Master directory of every internal & external client.',
    '<button type="button" class="btn btn--gradient" data-slideover-open="clientPanel" data-mode="new">'
      . icon('users') . ' New Client</button>'
); ?>

<div class="toolbar">
  <form method="get" class="toolbar__search">
    <?= '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>' ?>
    <input type="text" name="q" value="<?= e($q) ?>" placeholder="Search company, email, contact…" autocomplete="off">
  </form>
  <span class="badge"><?= count($rows) ?> client<?= count($rows) === 1 ? '' : 's' ?></span>
</div>

<?php if (!$rows): ?>
  <div class="table-card">
    <div class="empty">
      <div class="empty__icon"><?= icon('users') ?></div>
      <p class="empty__t"><?= $q ? 'No clients match your search' : 'No clients yet' ?></p>
      <p class="empty__d"><?= $q ? 'Try a different keyword.' : 'Add your first client to start tracking renewals and AMC contracts.' ?></p>
      <?php if (!$q): ?>
        <button type="button" class="btn btn--gradient" data-slideover-open="clientPanel" data-mode="new"><?= icon('users') ?> New Client</button>
      <?php endif; ?>
    </div>
  </div>
<?php else: ?>
  <div class="table-card">
    <div style="overflow-x:auto">
      <table class="table">
        <thead><tr>
          <th>Company</th><th>Type</th><th>Primary contact</th><th>Email</th><th>Phone</th><th>Added</th><th style="text-align:right">Actions</th>
        </tr></thead>
        <tbody>
          <?php foreach ($rows as $r): ?>
            <tr>
              <td><b><?= e($r['company_name']) ?></b><?php if ($r['address']): ?><div style="color:var(--muted-foreground);font-size:12px;margin-top:2px;"><?= e(mb_strimwidth((string)$r['address'], 0, 60, '…')) ?></div><?php endif; ?></td>
              <td><span class="badge <?= $r['client_type'] === 'internal' ? 'badge--primary' : 'badge--muted' ?>"><?= e(ucfirst($r['client_type'])) ?></span></td>
              <td><?= e($r['primary_contact'] ?: '—') ?></td>
              <td><?= e($r['primary_email'] ?: '—') ?></td>
              <td><?= e($r['primary_phone'] ?: '—') ?></td>
              <td style="color:var(--muted-foreground);font-size:12px;"><?= e(format_date($r['created_at'])) ?></td>
              <td style="text-align:right;white-space:nowrap;">
                <div class="row-actions">
                  <button type="button" class="icon-btn" title="Edit"
                    data-slideover-open="clientPanel"
                    data-mode="edit"
                    data-id="<?= e($r['id']) ?>"
                    data-company_name="<?= e($r['company_name']) ?>"
                    data-primary_contact="<?= e($r['primary_contact'] ?? '') ?>"
                    data-primary_email="<?= e($r['primary_email'] ?? '') ?>"
                    data-primary_phone="<?= e($r['primary_phone'] ?? '') ?>"
                    data-address="<?= e($r['address'] ?? '') ?>"
                    data-client_type="<?= e($r['client_type']) ?>"
                    data-notes="<?= e($r['notes'] ?? '') ?>">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/></svg>
                  </button>
                  <button type="button" class="icon-btn icon-btn--danger" title="Delete"
                    data-delete-client="<?= e($r['id']) ?>" data-name="<?= e($r['company_name']) ?>">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6 17.4 20.2A2 2 0 0 1 15.4 22H8.6a2 2 0 0 1-2-1.8L5 6"/></svg>
                  </button>
                </div>
              </td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  </div>
<?php endif; ?>

<!-- ===== Slideover: New / Edit Client ===== -->
<div class="slideover-back" data-slideover-back="clientPanel"></div>
<aside class="slideover" id="clientPanel" aria-hidden="true">
  <div class="slideover__head">
    <div>
      <h2 class="slideover__title" data-panel-title>New Client</h2>
      <p class="slideover__sub">Add a client to start tracking renewals, AMC contracts and credentials.</p>
    </div>
    <button type="button" class="icon-btn" data-slideover-close aria-label="Close">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
    </button>
  </div>
  <form id="clientForm" method="post" action="/app/actions/clients.php" class="slideover__body">
    <?= csrf_field() ?>
    <input type="hidden" name="action" value="upsert">
    <input type="hidden" name="id" value="">
    <div class="field">
      <label class="field__label">Company name <span class="req">*</span></label>
      <input type="text" name="company_name" required>
    </div>
    <div class="field-row">
      <div class="field">
        <label class="field__label">Client type</label>
        <select name="client_type">
          <option value="external">External</option>
          <option value="internal">Internal</option>
        </select>
      </div>
      <div class="field">
        <label class="field__label">Primary contact</label>
        <input type="text" name="primary_contact">
      </div>
    </div>
    <div class="field-row">
      <div class="field">
        <label class="field__label">Primary email</label>
        <input type="email" name="primary_email">
      </div>
      <div class="field">
        <label class="field__label">Primary phone</label>
        <input type="tel" name="primary_phone">
      </div>
    </div>
    <div class="field">
      <label class="field__label">Address</label>
      <textarea name="address" rows="2"></textarea>
    </div>
    <div class="field">
      <label class="field__label">Notes</label>
      <textarea name="notes" rows="3"></textarea>
    </div>
  </form>
  <div class="slideover__foot">
    <button type="button" class="btn btn--ghost" data-slideover-close>Cancel</button>
    <button type="submit" form="clientForm" class="btn btn--gradient" data-submit-label>Save Client</button>
  </div>
</aside>

<script>
(function () {
  const panel = document.getElementById('clientPanel');
  const form  = document.getElementById('clientForm');
  const title = panel.querySelector('[data-panel-title]');
  const submit= panel.querySelector('[data-submit-label]');

  panel.addEventListener('slideover:open', (e) => {
    const t = e.detail.trigger;
    const mode = t.dataset.mode || 'new';
    form.reset();
    form.querySelector('[name=id]').value = '';
    if (mode === 'edit') {
      title.textContent = 'Edit Client';
      submit.textContent = 'Save changes';
      ['id','company_name','primary_contact','primary_email','primary_phone','address','client_type','notes'].forEach((k) => {
        const el = form.querySelector(`[name=${k}]`); if (el && t.dataset[k] !== undefined) el.value = t.dataset[k];
      });
    } else {
      title.textContent = 'New Client';
      submit.textContent = 'Save Client';
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submit.disabled = true; submit.textContent = 'Saving…';
    try {
      const fd = new FormData(form);
      const r  = await fetch(form.action, { method: 'POST', body: fd, credentials: 'same-origin' });
      const j  = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || 'Save failed');
      toast(j.message || 'Saved', 'success');
      setTimeout(() => location.reload(), 300);
    } catch (err) {
      submit.disabled = false; submit.textContent = 'Save Client';
      toast(err.message, 'error');
    }
  });

  document.querySelectorAll('[data-delete-client]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id   = btn.dataset.deleteClient;
      const name = btn.dataset.name;
      openDeleteConfirm({
        title: 'Delete client?',
        message: `This permanently removes "${name}" and any related links. This cannot be undone.`,
        typeWord: 'DELETE',
        onConfirm: async () => {
          const j = await postJSON('/app/actions/clients.php', { action: 'delete', id });
          if (!j.ok) throw new Error(j.error || 'Delete failed');
          toast('Client deleted', 'success');
          setTimeout(() => location.reload(), 300);
        },
      });
    });
  });
})();
</script>

<?php require __DIR__ . '/../includes/layout_footer.php'; ?>
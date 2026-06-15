<?php
require __DIR__ . '/../../includes/bootstrap.php';
$page_title = 'Dashboard';
require __DIR__ . '/../../includes/layout_header.php';
?>
<div class="card" style="padding:24px;">
  <h1 style="margin:0 0 6px;font-size:22px;font-weight:600;">Welcome, <?= e(current_user()['full_name']) ?></h1>
  <p style="margin:0;color:var(--muted-foreground);font-size:14px;">
    Phase 1 of the PHP/MySQL port is in place &mdash; auth, sidebar, header, design tokens, and the typed-DELETE confirm modal are all live.
    Modules (Clients, Renewals, AMC, Time Entries, Vault, Templates, Users, Import/Export, Backup, Settings) ship in the next phases.
  </p>
</div>

<div style="margin-top:16px;display:flex;gap:8px;">
  <button type="button" class="btn btn--ghost"
    onclick="openDeleteConfirm({title:'Delete demo item',message:'This will permanently remove the demo item.',onConfirm:async()=>{await new Promise(r=>setTimeout(r,400));toast('Demo item deleted.','success');}})">
    Try the typed-DELETE modal
  </button>
  <button type="button" class="btn btn--primary" onclick="toast('Toasts are wired up.','success',{title:'Nice'})">
    Try a toast
  </button>
</div>
<?php require __DIR__ . '/../../includes/layout_footer.php'; ?>

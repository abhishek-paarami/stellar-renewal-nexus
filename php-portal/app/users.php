<?php
require __DIR__ . '/../includes/bootstrap.php';
$me = require_super_admin();
$page_title = 'User Management';

$tab = (string)($_GET['tab'] ?? 'all');
$rows  = db_all('SELECT id, full_name, email, role, custom_role_id, is_active, last_login, created_at FROM user_profiles ORDER BY created_at');
$roles = db_all('SELECT id, name, label FROM custom_roles ORDER BY label');

$counts = ['all'=>count($rows),'super_admin'=>0,'manager'=>0];
foreach ($roles as $cr) $counts['custom:'.$cr['id']] = 0;
foreach ($rows as $r) {
    if ($r['role']==='super_admin') $counts['super_admin']++;
    elseif (!$r['custom_role_id']) $counts['manager']++;
    if ($r['custom_role_id']) $counts['custom:'.$r['custom_role_id']] = ($counts['custom:'.$r['custom_role_id']] ?? 0) + 1;
}
$filtered = array_values(array_filter($rows, function($r) use ($tab) {
    if ($tab==='all') return true;
    if ($tab==='super_admin') return $r['role']==='super_admin';
    if ($tab==='manager')     return $r['role']==='manager' && !$r['custom_role_id'];
    if (str_starts_with($tab,'custom:')) return $r['custom_role_id'] === substr($tab,7);
    return true;
}));
$rolesById = []; foreach ($roles as $cr) $rolesById[$cr['id']] = $cr;
$roleLabel = function(array $r) use ($rolesById): string {
    if ($r['custom_role_id'] && isset($rolesById[$r['custom_role_id']])) return $rolesById[$r['custom_role_id']]['label'];
    return $r['role']==='super_admin' ? 'Super Admin' : 'Manager';
};

require __DIR__ . '/../../includes/layout_header.php';
?>
<?php render_page_header('User Management',
    'Manage roles, invite team members, and control portal access — all in one place.',
    '<button type="button" class="btn btn--gradient" data-invite-open>' . icon('shield') . ' Invite User</button>'
); ?>

<div class="card" style="padding:14px;margin-bottom:16px">
  <div style="font-size:13px;font-weight:600;margin-bottom:8px">Custom Roles</div>
  <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">
    <?php foreach ($roles as $cr): ?>
      <span class="badge" style="padding-right:4px">
        <?= e($cr['label']) ?>
        <button type="button" data-del-role="<?= e($cr['id']) ?>" data-label="<?= e($cr['label']) ?>" style="background:none;border:none;color:var(--destructive);cursor:pointer;margin-left:4px;padding:0 4px;font-weight:700">×</button>
      </span>
    <?php endforeach; ?>
    <input type="text" id="newRoleInput" placeholder="New role (e.g. Developer)" style="height:32px;padding:0 10px;border-radius:8px;border:1px solid var(--border);background:var(--card);width:220px;font-size:13px">
    <button type="button" class="btn btn--ghost" id="addRoleBtn" style="height:32px;padding:0 12px">+ Add</button>
  </div>
</div>

<div class="tabs" style="margin-bottom:12px;flex-wrap:wrap">
  <a href="?tab=all"          class="tabs__btn<?= $tab==='all'?' is-active':''         ?>">All (<?= $counts['all'] ?>)</a>
  <a href="?tab=super_admin"  class="tabs__btn<?= $tab==='super_admin'?' is-active':'' ?>">Super Admin (<?= $counts['super_admin'] ?>)</a>
  <a href="?tab=manager"      class="tabs__btn<?= $tab==='manager'?' is-active':''     ?>">Manager (<?= $counts['manager'] ?>)</a>
  <?php foreach ($roles as $cr): $k='custom:'.$cr['id']; ?>
    <a href="?tab=<?= e($k) ?>" class="tabs__btn<?= $tab===$k?' is-active':'' ?>"><?= e($cr['label']) ?> (<?= $counts[$k] ?? 0 ?>)</a>
  <?php endforeach; ?>
</div>

<div class="table-card">
  <div style="overflow-x:auto"><table class="table">
    <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Last Login</th><th>Joined</th><th style="text-align:right">Actions</th></tr></thead>
    <tbody>
    <?php if (!$filtered): ?>
      <tr><td colspan="6" style="text-align:center;color:var(--muted-foreground);padding:32px">No users in this role yet.</td></tr>
    <?php else: foreach ($filtered as $r): ?>
      <tr>
        <td><div style="font-weight:500"><?= e($r['full_name']) ?></div><div style="font-size:12px;color:var(--muted-foreground)"><?= e($r['email']) ?></div></td>
        <td><span class="badge"><?= e($roleLabel($r)) ?></span></td>
        <td><span class="badge <?= $r['is_active']?'badge--success':'badge--danger' ?>"><?= $r['is_active']?'Active':'Disabled' ?></span></td>
        <td style="font-size:12px;color:var(--muted-foreground)"><?= $r['last_login'] ? e(format_date($r['last_login'])) : 'Never' ?></td>
        <td style="font-size:12px;color:var(--muted-foreground)"><?= e(format_date($r['created_at'])) ?></td>
        <td style="text-align:right;white-space:nowrap"><div class="row-actions">
          <button type="button" class="icon-btn" title="Edit" data-edit-user='<?= e(json_encode([
            'id'=>$r['id'],'full_name'=>$r['full_name'],'email'=>$r['email'],'role'=>$r['role'],
            'custom_role_id'=>$r['custom_role_id'],'is_active'=>(int)$r['is_active'],
            'is_self'=>$r['id']===$me['id']?1:0,
          ], JSON_UNESCAPED_UNICODE)) ?>'>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/></svg>
          </button>
          <button type="button" class="icon-btn" title="Reset password" data-reset-user="<?= e($r['id']) ?>" data-email="<?= e($r['email']) ?>">
            <?= icon('key') ?>
          </button>
          <button type="button" class="icon-btn icon-btn--danger" title="Delete" data-del-user="<?= e($r['id']) ?>" data-email="<?= e($r['email']) ?>" <?= $r['id']===$me['id']?'disabled':'' ?>>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6 17.4 20.2A2 2 0 0 1 15.4 22H8.6a2 2 0 0 1-2-1.8L5 6"/></svg>
          </button>
        </div></td>
      </tr>
    <?php endforeach; endif; ?>
    </tbody>
  </table></div>
</div>

<!-- Invite dialog -->
<div class="dialog-back" id="inviteShell">
  <div class="dialog dialog--md" role="dialog" aria-modal="true">
    <div class="dialog__head">
      <h3 class="dialog__title"><?= icon('shield') ?> Invite User</h3>
      <p class="dialog__sub">Create a portal account for a team member.</p>
    </div>
    <form id="inviteForm" class="dialog__body" method="post" action="/app/actions/users.php">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="create">
      <div class="field"><label class="field__label">Full Name</label><input type="text" name="full_name" required></div>
      <div class="field"><label class="field__label">Email</label><input type="email" name="email" required></div>
      <div class="field"><label class="field__label">Temporary Password</label><input type="text" name="password" required minlength="8"></div>
      <div class="field"><label class="field__label">Role</label>
        <select name="role">
          <option value="manager">Manager</option>
          <option value="super_admin">Super Admin</option>
          <?php foreach ($roles as $cr): ?><option value="custom:<?= e($cr['id']) ?>"><?= e($cr['label']) ?></option><?php endforeach; ?>
        </select>
        <div class="field__hint">Custom roles get Manager-level permissions plus the role label as their title.</div>
      </div>
    </form>
    <div class="dialog__foot">
      <button type="button" class="btn btn--ghost" data-dialog-close>Cancel</button>
      <button type="submit" form="inviteForm" class="btn btn--gradient" data-invite-submit>Create User</button>
    </div>
  </div>
</div>

<!-- Edit dialog -->
<div class="dialog-back" id="editUserShell">
  <div class="dialog dialog--md" role="dialog" aria-modal="true">
    <div class="dialog__head">
      <h3 class="dialog__title">Edit User</h3>
      <p class="dialog__sub" data-edit-sub>Update profile, role, and access.</p>
    </div>
    <form id="editUserForm" class="dialog__body" method="post" action="/app/actions/users.php">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="update">
      <input type="hidden" name="id" value="">
      <div class="field"><label class="field__label">Full Name</label><input type="text" name="full_name" required></div>
      <div class="field"><label class="field__label">Email</label><input type="email" name="email_display" disabled></div>
      <div class="field"><label class="field__label">Role</label>
        <select name="role" data-edit-role>
          <option value="manager">Manager</option>
          <option value="super_admin">Super Admin</option>
          <?php foreach ($roles as $cr): ?><option value="custom:<?= e($cr['id']) ?>"><?= e($cr['label']) ?></option><?php endforeach; ?>
        </select>
      </div>
      <div class="field" data-active-row style="border:1px solid var(--border);border-radius:8px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between">
        <div><div style="font-weight:500;font-size:13px">Account Active</div><div style="font-size:11px;color:var(--muted-foreground)">Disabled users cannot sign in.</div></div>
        <label class="switch"><input type="checkbox" name="is_active" value="1" checked><span></span></label>
      </div>
    </form>
    <div class="dialog__foot">
      <button type="button" class="btn btn--ghost" data-dialog-close>Cancel</button>
      <button type="submit" form="editUserForm" class="btn btn--gradient" data-edit-submit>Save Changes</button>
    </div>
  </div>
</div>

<!-- Reset password dialog -->
<div class="dialog-back" id="resetPwShell">
  <div class="dialog dialog--md" role="dialog" aria-modal="true">
    <div class="dialog__head">
      <h3 class="dialog__title"><?= icon('key') ?> Reset Password</h3>
      <p class="dialog__sub" data-reset-sub>Set a new password.</p>
    </div>
    <form id="resetPwForm" class="dialog__body" method="post" action="/app/actions/users.php">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="reset_password">
      <input type="hidden" name="id" value="">
      <div class="field"><label class="field__label">New password</label><input type="text" name="password" required minlength="8" placeholder="Min. 8 characters"></div>
      <div class="field__hint">Tip: tell the user the new password through a secure channel.</div>
    </form>
    <div class="dialog__foot">
      <button type="button" class="btn btn--ghost" data-dialog-close>Cancel</button>
      <button type="submit" form="resetPwForm" class="btn btn--gradient" data-reset-submit>Reset password</button>
    </div>
  </div>
</div>

<script>
(function(){
  const open  = el => { el.style.display='flex'; el.classList.add('is-open'); };
  const close = el => { el.classList.remove('is-open'); el.style.display='none'; };
  document.addEventListener('click', e => {
    if (e.target.closest('[data-dialog-close]')) {
      document.querySelectorAll('.dialog-back.is-open').forEach(close);
    }
  });

  // Invite
  const inv = document.getElementById('inviteShell');
  document.querySelector('[data-invite-open]').addEventListener('click', () => { inv.querySelector('form').reset(); open(inv); });
  document.getElementById('inviteForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, b = f.querySelector('[data-invite-submit]'), o = b.textContent;
    b.disabled=true; b.textContent='Creating…';
    try {
      const j = await (await fetch(f.action,{method:'POST',body:new FormData(f),credentials:'same-origin'})).json();
      if (!j.ok) throw new Error(j.error||'Failed');
      toast(j.message||'User created','success'); setTimeout(()=>location.reload(),350);
    } catch(err){ b.disabled=false; b.textContent=o; toast(err.message,'error'); }
  });

  // Edit
  const ed = document.getElementById('editUserShell');
  const edForm = document.getElementById('editUserForm');
  document.querySelectorAll('[data-edit-user]').forEach(btn => btn.addEventListener('click', () => {
    const d = JSON.parse(btn.dataset.editUser);
    edForm.reset();
    edForm.querySelector('[name=id]').value = d.id;
    edForm.querySelector('[name=full_name]').value = d.full_name;
    edForm.querySelector('[name=email_display]').value = d.email;
    const sel = edForm.querySelector('[data-edit-role]');
    sel.value = d.custom_role_id ? ('custom:'+d.custom_role_id) : d.role;
    sel.disabled = !!d.is_self;
    const act = edForm.querySelector('[name=is_active]');
    act.checked = !!d.is_active; act.disabled = !!d.is_self;
    ed.querySelector('[data-edit-sub]').textContent = 'Update profile, role, and access for ' + d.email + '.';
    open(ed);
  }));
  edForm.addEventListener('submit', async e => {
    e.preventDefault();
    const b = edForm.querySelector('[data-edit-submit]'), o = b.textContent;
    b.disabled=true; b.textContent='Saving…';
    try {
      const j = await (await fetch(edForm.action,{method:'POST',body:new FormData(edForm),credentials:'same-origin'})).json();
      if (!j.ok) throw new Error(j.error||'Failed');
      toast('User updated','success'); setTimeout(()=>location.reload(),350);
    } catch(err){ b.disabled=false; b.textContent=o; toast(err.message,'error'); }
  });

  // Reset password
  const rs = document.getElementById('resetPwShell');
  const rsForm = document.getElementById('resetPwForm');
  document.querySelectorAll('[data-reset-user]').forEach(btn => btn.addEventListener('click', () => {
    rsForm.reset();
    rsForm.querySelector('[name=id]').value = btn.dataset.resetUser;
    rs.querySelector('[data-reset-sub]').innerHTML = 'Set a new password for <b>'+btn.dataset.email+'</b>.';
    open(rs);
  }));
  rsForm.addEventListener('submit', async e => {
    e.preventDefault();
    const b = rsForm.querySelector('[data-reset-submit]'), o = b.textContent;
    b.disabled=true; b.textContent='Saving…';
    try {
      const j = await (await fetch(rsForm.action,{method:'POST',body:new FormData(rsForm),credentials:'same-origin'})).json();
      if (!j.ok) throw new Error(j.error||'Failed');
      toast('Password reset','success'); close(rs);
    } catch(err){ b.disabled=false; b.textContent=o; toast(err.message,'error'); }
  });

  // Delete user
  document.querySelectorAll('[data-del-user]').forEach(btn => btn.addEventListener('click', () => {
    openDeleteConfirm({
      title: 'Delete this user?',
      message: `This will permanently delete "${btn.dataset.email}" and revoke their portal access.`,
      typeWord: 'DELETE',
      onConfirm: async () => {
        const j = await postJSON('/app/actions/users.php',{action:'delete',id:btn.dataset.delUser});
        if (!j.ok) throw new Error(j.error||'Failed');
        toast('User deleted','success'); setTimeout(()=>location.reload(),350);
      },
    });
  }));

  // Add custom role
  document.getElementById('addRoleBtn').addEventListener('click', async () => {
    const v = document.getElementById('newRoleInput').value.trim();
    if (!v) return;
    try {
      const j = await postJSON('/app/actions/users.php',{action:'add_role',label:v});
      if (!j.ok) throw new Error(j.error||'Failed');
      toast('Role added','success'); setTimeout(()=>location.reload(),350);
    } catch(err){ toast(err.message,'error'); }
  });

  // Delete role
  document.querySelectorAll('[data-del-role]').forEach(btn => btn.addEventListener('click', () => {
    openDeleteConfirm({
      title: 'Delete this role?',
      message: `This will permanently delete the custom role "${btn.dataset.label}".`,
      typeWord: 'DELETE',
      onConfirm: async () => {
        const j = await postJSON('/app/actions/users.php',{action:'delete_role',id:btn.dataset.delRole});
        if (!j.ok) throw new Error(j.error||'Failed');
        toast('Role deleted','success'); setTimeout(()=>location.reload(),350);
      },
    });
  }));
})();
</script>
<style>
.switch{position:relative;display:inline-block;width:38px;height:22px}
.switch input{opacity:0;width:0;height:0}
.switch span{position:absolute;cursor:pointer;inset:0;background:var(--muted);border-radius:22px;transition:.2s}
.switch span:before{position:absolute;content:"";height:16px;width:16px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.2s}
.switch input:checked + span{background:var(--primary)}
.switch input:checked + span:before{transform:translateX(16px)}
.switch input:disabled + span{opacity:.5;cursor:not-allowed}
</style>
<?php require __DIR__ . '/../../includes/layout_footer.php'; ?>
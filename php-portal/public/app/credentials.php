<?php
require __DIR__ . '/../../includes/bootstrap.php';
$me = require_super_admin();
$page_title = 'Credentials Vault';

$preset = (string)($_GET['preset'] ?? 'today');
[$from, $to] = (function(string $p) {
    $now = new DateTime('now');
    switch ($p) {
        case 'today':     $f = (clone $now)->setTime(0,0,0); break;
        case 'yesterday': $f = (clone $now)->modify('-1 day')->setTime(0,0,0); $now = (clone $f)->setTime(23,59,59); break;
        case '7d':        $f = (clone $now)->modify('-7 days'); break;
        case '30d':       $f = (clone $now)->modify('-30 days'); break;
        case 'all':       return [null, null];
        default:          $f = (clone $now)->setTime(0,0,0);
    }
    return [$f->format('Y-m-d H:i:s'), $now->format('Y-m-d H:i:s')];
})($preset);

$sql = 'SELECT l.*, r.domain, u.full_name, u.email FROM credential_access_logs l
        LEFT JOIN renewals r ON r.id = l.renewal_id
        LEFT JOIN user_profiles u ON u.id = l.accessed_by';
$params = [];
if ($from) { $sql .= ' WHERE l.accessed_at >= ? AND l.accessed_at <= ?'; $params=[$from,$to]; }
$sql .= ' ORDER BY l.accessed_at DESC LIMIT 500';
$logs = db_all($sql, $params);

require __DIR__ . '/../../includes/layout_header.php';
?>
<?php render_page_header('Credentials Vault',
    'Encrypted credentials are accessed from each Renewal row. Every access is recorded below.',
    '<span class="badge"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> AES-256-GCM · Super Admin gated</span>'
); ?>

<div class="card" style="padding:0;overflow:hidden">
  <div style="display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid var(--border);background:rgba(0,0,0,.02);font-size:13px;font-weight:500">
    <?= icon('key') ?> Access Audit Log
    <span class="badge" style="margin-left:auto"><?= count($logs) ?> events</span>
  </div>
  <div style="display:flex;flex-wrap:wrap;gap:6px;padding:10px 16px;border-bottom:1px solid var(--border)">
    <?php foreach (['today'=>'Today','yesterday'=>'Yesterday','7d'=>'Last 7 days','30d'=>'Last 30 days','all'=>'All time'] as $k=>$lbl): ?>
      <a href="?preset=<?= $k ?>" class="tabs__btn<?= $preset===$k?' is-active':'' ?>"><?= $lbl ?></a>
    <?php endforeach; ?>
  </div>
  <?php if (!$logs): ?>
    <div class="empty">
      <div class="empty__icon"><?= icon('key') ?></div>
      <p class="empty__t">No credential accesses yet</p>
      <p class="empty__d">Access events appear here when Super Admins reveal stored credentials.</p>
    </div>
  <?php else: ?>
    <div style="overflow-x:auto"><table class="table">
      <thead><tr><th>When</th><th>User</th><th>Renewal</th><th>IP</th></tr></thead>
      <tbody>
      <?php foreach ($logs as $l): ?>
        <tr>
          <td style="font-family:ui-monospace,monospace;font-size:12px"><?= e(format_date($l['accessed_at'],'d M Y')) ?> · <?= e(date('H:i:s', strtotime($l['accessed_at']))) ?></td>
          <td><div style="font-weight:500"><?= e($l['full_name'] ?: substr($l['accessed_by'],0,8)) ?></div><div style="font-size:11px;color:var(--muted-foreground)"><?= e($l['email'] ?? '') ?></div></td>
          <td style="color:var(--muted-foreground)"><?= e($l['domain'] ?? '—') ?></td>
          <td style="font-family:ui-monospace,monospace;font-size:11px;color:var(--muted-foreground)"><?= e($l['ip_address'] ?? '—') ?></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table></div>
  <?php endif; ?>
</div>
<?php require __DIR__ . '/../../includes/layout_footer.php'; ?>
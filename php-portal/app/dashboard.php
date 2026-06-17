<?php
require __DIR__ . '/../includes/bootstrap.php';
require_login();
$page_title = 'Dashboard';

// ---- Stats ----
$totalClients  = (int)(db_one('SELECT COUNT(*) c FROM clients')['c'] ?? 0);
$totalRenewals = (int)(db_one('SELECT COUNT(*) c FROM renewals')['c'] ?? 0);
$totalAmc      = (int)(db_one('SELECT COUNT(*) c FROM amc_clients')['c'] ?? 0);

$today = new DateTimeImmutable('today');
$soon  = $today->modify('+30 days')->format('Y-m-d');
$expiringSoon = (int)(db_one(
    'SELECT COUNT(*) c FROM renewals
     WHERE (domain_expiry  BETWEEN ? AND ?)
        OR (hosting_expiry BETWEEN ? AND ?)
        OR (ga_expiry      BETWEEN ? AND ?)',
    [$today->format('Y-m-d'), $soon, $today->format('Y-m-d'), $soon, $today->format('Y-m-d'), $soon]
)['c'] ?? 0);
$expired = (int)(db_one(
    'SELECT COUNT(*) c FROM renewals
     WHERE (domain_expiry  < ? AND domain_expiry  IS NOT NULL)
        OR (hosting_expiry < ? AND hosting_expiry IS NOT NULL)
        OR (ga_expiry      < ? AND ga_expiry      IS NOT NULL)',
    [$today->format('Y-m-d'), $today->format('Y-m-d'), $today->format('Y-m-d')]
)['c'] ?? 0);

$monthStart = $today->format('Y-m-01');
$hoursRow = db_one(
    'SELECT COALESCE(SUM(hours + minutes/60),0) h FROM time_entries
     WHERE entry_date >= ? AND status = "approved"',
    [$monthStart]
);
$hoursThisMonth = round((float)($hoursRow['h'] ?? 0), 1);

// ---- Upcoming (next 60 days) ----
$upcoming = [];
$rows = db_all(
    'SELECT id, domain, domain_expiry, hosting_expiry, ga_expiry FROM renewals'
);
foreach ($rows as $r) {
    foreach (['domain_expiry' => 'Domain', 'hosting_expiry' => 'Hosting', 'ga_expiry' => 'GA'] as $k => $kind) {
        if (!$r[$k]) continue;
        $d = days_until($r[$k]);
        if ($d !== null && $d >= 0 && $d <= 60) {
            $upcoming[] = ['id' => $r['id'], 'domain' => $r['domain'], 'kind' => $kind, 'date' => $r[$k], 'days' => $d];
        }
    }
}
usort($upcoming, fn($a, $b) => $a['days'] <=> $b['days']);
$upcoming = array_slice($upcoming, 0, 8);

require __DIR__ . '/../../includes/layout_header.php';
?>
<?php render_page_header('Dashboard', 'Snapshot of clients, renewals and AMC hours.'); ?>

<div class="stat-grid">
  <div class="stat">
    <div class="stat__icon"><?= icon('users') ?></div>
    <div class="stat__label">Clients</div>
    <div class="stat__value"><?= $totalClients ?></div>
  </div>
  <div class="stat">
    <div class="stat__icon"><?= icon('refresh') ?></div>
    <div class="stat__label">Renewals tracked</div>
    <div class="stat__value"><?= $totalRenewals ?></div>
  </div>
  <div class="stat">
    <div class="stat__icon"><?= icon('wrench') ?></div>
    <div class="stat__label">AMC clients</div>
    <div class="stat__value"><?= $totalAmc ?></div>
  </div>
  <div class="stat stat--warning">
    <div class="stat__icon"><?= icon('clock') ?></div>
    <div class="stat__label">Expiring in 30 days</div>
    <div class="stat__value"><?= $expiringSoon ?></div>
  </div>
  <div class="stat stat--danger">
    <div class="stat__icon"><?= icon('clock') ?></div>
    <div class="stat__label">Expired</div>
    <div class="stat__value"><?= $expired ?></div>
  </div>
  <div class="stat stat--success">
    <div class="stat__icon"><?= icon('clock') ?></div>
    <div class="stat__label">Hours this month</div>
    <div class="stat__value"><?= $hoursThisMonth ?></div>
  </div>
</div>

<div class="section">
  <div class="section__hd">
    <h2 class="section__t">Upcoming renewals (next 60 days)</h2>
    <a href="/app/renewals.php" class="btn btn--ghost btn--sm">View all</a>
  </div>
  <div class="section__body">
    <?php if (!$upcoming): ?>
      <div class="empty">
        <div class="empty__icon"><?= icon('refresh') ?></div>
        <p class="empty__t">Nothing expiring soon</p>
        <p class="empty__d">All tracked renewals are at least 60 days out.</p>
      </div>
    <?php else: ?>
      <table class="table">
        <thead><tr><th>Domain</th><th>Type</th><th>Expires</th><th>In</th></tr></thead>
        <tbody>
          <?php foreach ($upcoming as $u):
            $cls = $u['days'] <= 7 ? 'badge--danger' : ($u['days'] <= 30 ? 'badge--warning' : 'badge--muted'); ?>
            <tr>
              <td><b><?= e($u['domain']) ?></b></td>
              <td><span class="badge"><?= e($u['kind']) ?></span></td>
              <td><?= e(format_date($u['date'])) ?></td>
              <td><span class="badge <?= $cls ?>"><?= (int)$u['days'] ?> days</span></td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    <?php endif; ?>
  </div>
</div>

<?php require __DIR__ . '/../../includes/layout_footer.php'; ?>
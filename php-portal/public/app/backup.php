<?php
require __DIR__ . '/../../includes/bootstrap.php';
$page_title = ucwords(str_replace('-', ' ', 'backup'));
require __DIR__ . '/../../includes/layout_header.php';
?>
<div class="card" style="padding:24px;">
  <h1 style="margin:0 0 6px;font-size:22px;font-weight:600;"><?= e($page_title) ?></h1>
  <p style="margin:0;color:var(--muted-foreground);font-size:14px;">
    This module is scheduled for an upcoming phase. The route exists so the sidebar reflects the final navigation layout.
  </p>
</div>
<?php require __DIR__ . '/../../includes/layout_footer.php'; ?>

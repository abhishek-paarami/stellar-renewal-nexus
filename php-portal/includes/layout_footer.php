    </main>
  </div>
</div>
<script src="/assets/js/app.js"></script>
<?php if ($msg = flash('toast_success')): ?>
<script>toast(<?= json_encode($msg) ?>, 'success');</script>
<?php endif; ?>
<?php if ($msg = flash('toast_error')): ?>
<script>toast(<?= json_encode($msg) ?>, 'error');</script>
<?php endif; ?>
</body>
</html>

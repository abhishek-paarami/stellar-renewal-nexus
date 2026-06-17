<?php
require __DIR__ . '/includes/bootstrap.php';
redirect(current_user() ? '/app/dashboard.php' : '/login.php');

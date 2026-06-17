<?php
require __DIR__ . '/includes/bootstrap.php';
log_activity('logout', ['description' => 'Signed out']);
logout();
redirect('/login.php');

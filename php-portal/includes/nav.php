<?php
// Sidebar nav items.  role: 'all' or 'super_admin'.
return [
  ['to' => '/app/dashboard.php',       'label' => 'Dashboard',          'role' => 'all',         'icon' => 'layout'],
  ['to' => '/app/clients.php',         'label' => 'Clients',            'role' => 'all',         'icon' => 'users'],
  ['to' => '/app/renewals.php',        'label' => 'Renewals',           'role' => 'all',         'icon' => 'refresh'],
  ['to' => '/app/amc.php',             'label' => 'AMC Clients',        'role' => 'all',         'icon' => 'wrench'],
  ['to' => '/app/time-entries.php',    'label' => 'Time Entries',       'role' => 'all',         'icon' => 'clock'],
  ['to' => '/app/credentials.php',     'label' => 'Credentials Vault',  'role' => 'super_admin', 'icon' => 'key'],
  ['to' => '/app/email-templates.php', 'label' => 'Email Templates',    'role' => 'super_admin', 'icon' => 'mail'],
  ['to' => '/app/users.php',           'label' => 'User Management',    'role' => 'super_admin', 'icon' => 'shield'],
  ['to' => '/app/import-export.php',   'label' => 'Import / Export',    'role' => 'all',         'icon' => 'sheet'],
  ['to' => '/app/backup.php',          'label' => 'DB Backup',          'role' => 'super_admin', 'icon' => 'db'],
  ['to' => '/app/settings.php',        'label' => 'Settings',           'role' => 'super_admin', 'icon' => 'settings'],
];

<?php
/**
 * Shared app shell header.  Usage:
 *   $page_title = 'Dashboard';
 *   require __DIR__ . '/../includes/layout_header.php';
 *   ... page content ...
 *   require __DIR__ . '/../includes/layout_footer.php';
 *
 * Expects $page_title (string) and a logged-in user.
 */

require_once __DIR__ . '/icons.php';
$nav  = require __DIR__ . '/nav.php';
$user = require_login();
$is_sa = $user['role'] === 'super_admin';
$current = $_SERVER['SCRIPT_NAME'] ?? '';
$initials = strtoupper(mb_substr(trim($user['full_name'] ?: $user['email']), 0, 1)) ?: '?';
?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="csrf-token" content="<?= e(csrf_token()) ?>">
<title><?= e(($page_title ?? 'Workspace') . ' — ' . ($GLOBALS['paarami_config']['app']['name'] ?? 'Portal')) ?></title>
<link rel="icon" href="/assets/favicon.png">
<link rel="stylesheet" href="/assets/css/app.css">
</head>
<body>
<div class="app">
  <aside class="sidebar">
    <div class="sidebar__head">
      <div class="sidebar__chip"><img src="/assets/logo.png" alt="Paarami Digital"></div>
      <div>
        <div class="sidebar__title">Internal Operations Portal</div>
        <div class="sidebar__kicker">Workspace</div>
      </div>
    </div>
    <nav class="sidebar__nav">
      <?php foreach ($nav as $n): if ($n['role'] === 'super_admin' && !$is_sa) continue;
        $active = $current === $n['to'] || str_starts_with($current, rtrim($n['to'], '.php') . '/');
      ?>
        <a href="<?= e($n['to']) ?>" class="nav-link<?= $active ? ' is-active' : '' ?>">
          <?= icon($n['icon']) ?><span><?= e($n['label']) ?></span>
        </a>
      <?php endforeach; ?>
    </nav>
    <div class="sidebar__foot">
      <div class="sidebar__help"><b>Need help?</b>Contact your Super Admin for access changes.</div>
    </div>
  </aside>

  <div class="main">
    <header class="topbar">
      <div class="topbar__kicker"><?= $is_sa ? 'Super Admin workspace' : 'Manager workspace' ?></div>
      <div style="position:relative;">
        <button type="button" class="user-chip" data-user-menu>
          <span class="avatar"><?= e($initials) ?></span>
          <span class="user-chip__txt">
            <span class="user-chip__name"><?= e($user['full_name']) ?></span>
            <span class="user-chip__role"><?= e(str_replace('_', ' ', $user['role'])) ?></span>
          </span>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <div class="user-menu" role="menu">
          <div class="user-menu__hd">
            <b><?= e($user['full_name']) ?></b>
            <small><?= e($user['email']) ?></small>
          </div>
          <hr>
          <button type="button" onclick="toast('Change-password modal is built in Phase 8.', 'info')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>
            Change password
          </button>
          <hr>
          <form method="post" action="/logout.php" style="margin:0;">
            <?= csrf_field() ?>
            <button type="submit" class="is-destructive">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>

    <main class="content">

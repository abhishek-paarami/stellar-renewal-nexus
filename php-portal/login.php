<?php
require __DIR__ . '/includes/bootstrap.php';

if (current_user()) redirect('/app/dashboard.php');

$error = null;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $res = attempt_login((string)input('email', ''), (string)input('password', ''));
    if ($res['ok']) {
        log_activity('login', ['description' => 'Signed in as ' . $res['user']['email']]);
        redirect('/app/dashboard.php');
    }
    $error = $res['error'];
}
?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sign in &mdash; Internal Operations Portal</title>
<link rel="icon" href="/assets/favicon.png">
<link rel="stylesheet" href="/assets/css/app.css">
</head>
<body class="login-body">
  <div class="login-bg">
    <div class="login-glow login-glow--a"></div>
    <div class="login-glow login-glow--b"></div>
    <div class="login-grid"></div>
  </div>

  <header class="login-top">
    <div class="login-brand">
      <div class="login-brand__chip"><img src="/assets/logo.png" alt="Paarami Digital"></div>
      <div class="login-brand__txt">Internal Operations Portal</div>
    </div>
    <div class="login-pill"><span class="login-dot"></span> All systems operational</div>
  </header>

  <main class="login-shell">
    <section class="login-marketing">
      <div class="login-eyebrow">&#x2728; Enterprise &middot; Audited &middot; Secure</div>
      <h1 class="login-h1">
        One workspace for every<br>
        <span class="login-h1--accent">renewal, AMC, and client hour</span>
      </h1>
      <p class="login-sub">
        The Paarami Internal Operations Portal centralizes domain &amp; hosting renewals,
        AMC hour tracking, encrypted credential vaults, and team activity.
      </p>
      <div class="login-feature-grid">
        <div class="login-feature"><div class="login-feature__t">Vault Secured</div><div class="login-feature__d">AES-encrypted credentials with audited access</div></div>
        <div class="login-feature"><div class="login-feature__t">Always Tracked</div><div class="login-feature__d">Every create, edit, and delete is logged</div></div>
        <div class="login-feature"><div class="login-feature__t">Auto Reminders</div><div class="login-feature__d">Domain, hosting, GA and AMC alerts</div></div>
      </div>
    </section>

    <section class="login-cardwrap">
      <div class="login-card">
        <div class="login-card__topline"></div>
        <div class="login-card__eyebrow">Welcome back</div>
        <h2 class="login-card__title">Sign in to <span class="login-h1--accent">continue</span></h2>
        <p class="login-card__sub">Use the team credentials issued by your Super Admin.</p>

        <?php if ($error): ?>
          <div class="login-alert"><?= e($error) ?></div>
        <?php endif; ?>

        <form method="post" class="login-form" autocomplete="on">
          <?= csrf_field() ?>
          <label class="login-label" for="email">Work email</label>
          <div class="login-input-wrap">
            <svg viewBox="0 0 24 24" class="login-input-icon" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/></svg>
            <input id="email" name="email" type="email" required autocomplete="email" placeholder="you@paaramidigital.com">
          </div>

          <label class="login-label" for="password">Password</label>
          <div class="login-input-wrap">
            <svg viewBox="0 0 24 24" class="login-input-icon" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>
            <input id="password" name="password" type="password" required autocomplete="current-password" placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;">
          </div>

          <button type="submit" class="login-submit">
            <span>Sign in securely</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="m13 5 7 7-7 7"/></svg>
          </button>
        </form>

        <div class="login-card__foot">
          <span>Need access? Contact your Super Admin.</span>
          <span>&#x1F512; SSL secured</span>
        </div>
      </div>
    </section>
  </main>

  <footer class="login-foot">
    <span>&copy; <?= date('Y') ?> Paarami Digital. Internal use only.</span>
    <span>v1.0</span>
  </footer>
</body>
</html>

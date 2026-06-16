# Security checklist — PHP portal

Internal company portal. Hardened against:

- Crawling: robots.txt + X-Robots-Tag noindex,nofollow blocks search
  engines and AI bots (GPTBot, ClaudeBot, Google-Extended, CCBot,
  PerplexityBot, anthropic-ai).
- Directory listing: Options -Indexes everywhere. Top-level .htaccess
  denies access outside /public/.
- Direct file access: .sql, .md, .log, .ini, .bak, .swp, .sample.php,
  config.php, composer.* are denied.
- includes / vendor / uploads directories require all denied; uploads
  also block PHP execution.
- CSRF: csrf_token / csrf_check on every POST action handler.
- XSS: all template output through e() (htmlspecialchars).
- SQL injection: 100% prepared statements via PDO helpers.
- Password hashing: bcrypt via password_hash / password_verify.
- Session: HttpOnly + Secure + SameSite=Lax, regenerated on login,
  idle timeout from config.session.lifetime.
- Brute force: per-IP login throttle using activity_logs.
- Vault: AES-256-GCM with key from config.vault.key_hex.
- Headers: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy,
  Permissions-Policy from bootstrap.php + .htaccess.
- Cron: /api/cron-reminders.php requires ?secret= matching
  config.cron.secret (hash_equals).

## Hostinger deploy

1. Unzip into your domain root.
2. Point the domain document root at the public/ folder.
3. Import schema.sql via phpMyAdmin.
4. Copy config.sample.php to config.php and fill values.
5. Daily cron: curl "https://your-domain/api/cron-reminders.php?secret=YOUR_SECRET"
# Deploying php-portal.zip to Hostinger

The ZIP is a **flat single-folder** package. Everything extracts directly
into `public_html/` — no outer wrapper, no split between web-root and
private folders. Sensitive paths (`includes/`, `vendor/`, `uploads/`,
`config.php`, `*.sql`, `*.md`) are protected by `.htaccess` rules that
ship inside the ZIP.

1. **Upload & extract**
   Hostinger File Manager → open `public_html/` → *Upload* `php-portal.zip`
   → *Extract here*. You should now see at the root of `public_html/`:
   `index.php`, `login.php`, `logout.php`, `.htaccess`, `app/`,
   `assets/`, `includes/`, `vendor/`, `uploads/`, `api/`, `robots.txt`,
   `config.sample.php`, `schema.sql`.

2. **Create the MySQL database** in *Hostinger → Databases → MySQL
   Databases*. Note the database name, username, and password.

3. **Import the schema** in *phpMyAdmin → Import*, upload
   `schema.sql`, run.

4. **Create config.php** by renaming `config.sample.php` to `config.php`
   (in `public_html/`). Fill in:
   - `db.host`, `db.name`, `db.user`, `db.pass` — values from step 2
   - `app.base_url` — e.g. `https://portal.yourdomain.com`
   - `vault.key_hex` — run `php -r "echo bin2hex(random_bytes(32));"` on
     any machine and paste the 64-char string. **Never change this later**
     or saved vault credentials become unreadable.
   - `cron.secret` — any long random string; used to authorize the
     reminder cron URL.
   - `smtp.*` — your Hostinger email account (or override in
     Portal → Settings → SMTP later).

5. **Create the first Super Admin user**. In phpMyAdmin run:

   ```sql
   INSERT INTO user_profiles (id, full_name, email, password_hash, role)
   VALUES (UUID(), 'Super Admin', 'admin@yourdomain.com',
           '$2y$12$REPLACE_ME', 'super_admin');
   ```

   Generate the hash on any PHP machine:
   `php -r "echo password_hash('YourPassword', PASSWORD_BCRYPT);"`

6. **Schedule the reminder cron** in *Hostinger → Advanced → Cron Jobs*.
   Run every 6 hours via HTTP (simplest on shared hosting):

   ```
   curl -s "https://portal.yourdomain.com/api/cron-reminders.php?secret=YOUR_CRON_SECRET"
   ```

7. **Test the login** at `https://portal.yourdomain.com/login.php` using
   the Super Admin email/password from step 5.

## Folder layout reference

```
public_html/
├── .htaccess              ← hardening + crawler blocking
├── index.php
├── login.php
├── logout.php
├── config.php             ← you create this from config.sample.php
├── config.sample.php
├── schema.sql
├── robots.txt
├── app/                   ← dashboard, renewals, amc, clients, ...
│   └── actions/           ← POST handlers (CSRF protected)
├── api/
│   └── cron-reminders.php ← hit via curl + ?secret=
├── assets/                ← css, js, images
├── includes/              ← .htaccess: deny all (PHP includes only)
├── vendor/                ← .htaccess: deny all (PHPMailer)
└── uploads/               ← .htaccess: deny PHP execution, chmod 775
```
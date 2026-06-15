# Deploying php-portal.zip to Hostinger

1. **Upload the ZIP**
   In Hostinger File Manager, open `public_html/`, click *Upload*, choose
   `php-portal.zip`, then *Extract* it. Move everything inside
   `php-portal/public/` to the root of `public_html/`, and keep
   `php-portal/includes/`, `php-portal/vendor/`, `php-portal/uploads/`,
   `php-portal/schema.sql`, and `php-portal/config.sample.php` **one level
   above** `public_html/` (Hostinger calls this `domains/<yourdomain>/`).
   This keeps secrets and PHP includes outside the web root.

   *If your hosting plan does not allow files above `public_html/`,* you may
   extract the whole `php-portal/` folder inside `public_html/` and point
   the domain's document root to `public_html/php-portal/public/`. Both
   layouts work.

2. **Create the MySQL database** in *Hostinger → Databases → MySQL
   Databases*. Note the database name, username, and password.

3. **Import the schema** in *phpMyAdmin → Import*, upload
   `php-portal/schema.sql`, run.

4. **Create config.php** by copying `config.sample.php` to `config.php`
   (next to `includes/`). Fill in:
   - `db.host`, `db.name`, `db.user`, `db.pass` — values from step 2
   - `app.base_url` — e.g. `https://portal.yourdomain.com`
   - `vault.key_hex` — run `php -r "echo bin2hex(random_bytes(32));"` on
     any machine and paste the 64-char string. **Never change this later**
     or saved vault credentials become unreadable.
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
   Run every 6 hours:

   ```
   /usr/bin/php /home/USERNAME/domains/yourdomain.com/php-portal/cron/send-reminders.php
   ```

   (The cron script ships in a later phase.)

7. **Test the login** at `https://portal.yourdomain.com/login.php` using
   the Super Admin email/password from step 5.

## Folder layout reference

```
/home/USERNAME/domains/portal.yourdomain.com/
├── php-portal/
│   ├── config.php                    ← edit this (NOT in zip — copy from sample)
│   ├── config.sample.php
│   ├── schema.sql
│   ├── DEPLOY-HOSTINGER.md
│   ├── includes/
│   ├── vendor/   (PHPMailer)
│   ├── uploads/  (chmod 775)
│   └── public/   ← this is the web root
│       ├── index.php
│       ├── login.php
│       ├── logout.php
│       ├── .htaccess
│       ├── app/
│       └── assets/
└── (cron/ added in later phase)
```
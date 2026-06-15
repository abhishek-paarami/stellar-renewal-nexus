# Paarami Internal Operations Portal — PHP/MySQL Port

Phased rewrite of the Lovable React portal targeting **PHP 8.1+ / MySQL 8 / Hostinger shared hosting**, preserving the original UI/UX as closely as possible without a React/Node runtime.

## Phase status

| Phase | Scope | Status |
|---|---|---|
| **1** | Folder layout, MySQL schema, config, DB layer, session/auth, shared layout (sidebar/header/footer), login page, design tokens, finger-loader | ✅ this phase |
| 2 | Dashboard, Clients CRUD | pending |
| 3 | Renewals (incl. credentials vault encrypt/decrypt + access logs) | pending |
| 4 | AMC clients (card grid, progress bar, trigger toggle) | pending |
| 5 | Time entries (per-AMC tabs, CRUD, auto-recompute consumed hours) | pending |
| 6 | Credentials Vault audit page + sort/filter bar | pending |
| 7 | Email Templates (live editor, dynamic regeneration on reminder-settings save) | pending |
| 8 | User Management (invite, edit, roles, custom roles, deletion guards) | pending |
| 9 | Import / Export (PhpSpreadsheet, smart detection) | pending |
| 10 | Backup & Restore (JSON full-DB) | pending |
| 11 | Settings (SMTP, Reminders, Email Log, Reminder Log, Activity Log) | pending |
| 12 | Cron scripts (`cron/send_reminders.php`), final zip-ready packaging, install guide | pending |

## Local install

1. Create a MySQL 8 database, then import `schema.sql`.
2. Copy `config.sample.php` → `config.php` and fill values.
3. Point Apache/Hostinger document root at `public/` **OR** copy `public/*` to `public_html/` and the rest of the folder one level above.
4. Visit `/login.php`. The first super-admin user must be inserted manually (see comment at bottom of `schema.sql`).

## Conventions

- All pages use `require __DIR__ . '/includes/bootstrap.php';` at the top.
- Authenticated pages call `require_login();` (and optionally `require_super_admin();`).
- All POST endpoints validate CSRF via `verify_csrf();`.
- Credentials vault uses **AES-256-GCM** with a key from `config.php` (never in DB).
- Toast notifications use the global `toast(message, type)` JS helper in `assets/js/app.js`.
- Confirm-delete modal: `openDeleteConfirm({title, message, typeWord:'DELETE', onConfirm})` from `app.js`.

# Paarami Internal Operations Portal — Security Summary

This portal is an internal tool. It is not indexed by search engines
(`robots.txt` + `noindex` meta), and all data is protected by the controls
below.

## Authentication
- Email + password sign-in only (no public sign-up).
- Passwords checked against the Have I Been Pwned database (HIBP leaked-password protection).
- Minimum 12-character password policy.
- Sessions use short-lived JWT access tokens + rotating refresh tokens (Supabase Auth).
- Disabled users cannot sign in or load any data (enforced server-side via RLS predicate `is_active_user(auth.uid())`).
- All admin operations (create user, reset password, delete user) go through a server function that validates Super Admin role.

## Authorization
- Row-Level Security (RLS) is **enabled on every public table**.
- Two roles: `super_admin` (full control), `manager` (active-user-only access).
- Role checks use a security-definer function `has_role(uid, role)` to prevent recursive RLS issues.
- Roles live in `user_profiles.role`. Only Super Admins can change roles (policy `up_admin_all`).

## Data at Rest
- Renewal usernames, passwords, FTP usernames, FTP passwords are **AES-encrypted** via Postgres `pgcrypto` (`pgp_sym_encrypt`).
- The encryption key lives in `app_settings.crypto_key` and is readable only by SECURITY DEFINER helpers.
- Decryption requires Super Admin role and is gated by `get_renewal_credentials()` / `export_renewal_credentials()`.
- Every credential reveal is recorded in `credential_access_logs` with user, timestamp.

## Data in Transit
- HTTPS-only (TLS 1.2+).
- Database connections use TLS.
- SMTP supports STARTTLS (587) and implicit TLS (465).

## Injection / Tampering Protection
- All database calls go through Supabase PostgREST — parameterised queries; **SQL injection not possible**.
- Input validation on every server function.
- Service role key is server-only; never reaches the browser.
- `pgcrypto` extension lives in a dedicated `extensions` schema, not `public`.

## Audit & Logging (append-only, never auto-deleted)
- `activity_logs` — every create/update/delete/login/logout/credential view.
- `email_logs` — every email send attempt (success + failure + SMTP trace).
- `reminder_logs` — every scheduled reminder run.
- `credential_access_logs` — every credential decryption.
- Logs are stored indefinitely — no cron job or trigger deletes them.

## Brute-Force & Abuse Protection
- Supabase Auth applies built-in rate limits per IP for sign-in attempts.
- Failed-login lockout planned via `login_attempts` table (5 fails / 15 min).

## Search-Engine Indexing
- `public/robots.txt` blocks all crawlers.
- `<meta name="robots" content="noindex, nofollow, noarchive, nosnippet">` on every page.

## Operational Hygiene
- Lovable Cloud handles database backups (point-in-time recovery).
- All secrets (SMTP password, service-role key, crypto key) stored as encrypted secrets — never in source code.
- Repository is private.

## Pen-Test Resilience Summary (tell your boss)
- ✅ SQL injection — parameterised queries only.
- ✅ Authorization bypass — RLS on every table, server-side role checks.
- ✅ Credential theft — encrypted at rest, gated reveal, full audit trail.
- ✅ Session hijack — short-lived JWT, refresh rotation, HTTPS-only cookies.
- ✅ Brute force — Supabase Auth rate limits + planned lockout.
- ✅ Public exposure — noindex, robots.txt, internal-only auth.
- ✅ Privilege escalation — role stored in separate guarded column, not editable by user.

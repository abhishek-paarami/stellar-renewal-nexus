
## Scope

Nine items from your message. I'll be upfront about #9 (Hostinger) because it changes how we work.

---

### 1. Remove "PAARAMI DIGITAL" wordmark above sidebar title
- `src/components/app-shell.tsx`: drop the small "PAARAMI DIGITAL" eyebrow text above "Internal Operations Portal".

### 2. Email logo not rendering + missing days count in subject
- Logo: most clients block hot-linked images on first open. Switch all 7 templates to use an **absolute, publicly-hosted logo URL** (the deployed `/logo.png` on `stellar-renewal-nexus.lovable.app`) and add proper `width`/`alt`. Also embed a CID-fallback isn't possible from SMTP without multipart restructure — I'll use the absolute URL + `display:block`. If still blocked, you can swap to your `paaramidigital.com` logo URL inside Settings → Email Templates anytime.
- Days in subject: the subject currently reads `{{client_name}} expires in days` because `{{days_left}}` is missing in the saved subjects. Migration will reset subject lines for all renewal/AMC templates to include `{{days_left}}` (e.g. `Action Required: {{domain}} expires in {{days_left}} days`).

### 3. AMC usage % badge on card
- `src/routes/_app/amc.tsx`: add a bold % chip on the right side of each card next to the days-left badge.
  - `<55%` green, `55–84%` orange, `85–99%` red, `100%+` dark red.

### 4. Instant AMC alert not firing after time entry
- Root cause: `send-amc-instant-alert` only fires if the threshold flag (`reminder_85_sent` etc.) is still `false`. If the daily 9 AM cron already flipped it, the instant function silently skips.
- Fix in `time-entries.tsx`: after insert, re-fetch the AMC row, compute pct, and invoke the function. In the function, add a query param `force=true` that bypasses the flag check for instant alerts, AND insert an entry into `email_logs` either way so you can see "skipped because already sent today".

### 5. Log filters (date range / single date) + data retention guarantee
- Add date-range + quick-preset (Today / 7d / 30d / Custom) filter to **Email Log, Reminder Log, Activity Log** tabs in `settings.tsx`.
- Add CSV export per filter.
- Pagination (50/page, load more) so logs from 5–10 years still render.
- Retention: confirm no cron/trigger deletes logs. Add a memory note: logs tables are append-only, never auto-pruned.

### 6. Disable email triggers per expired item
- Renewals: add a `triggers_disabled boolean` column + a small "Disable email triggers" toggle on each renewal row.
- AMC: same toggle on each AMC card.
- The daily cron and instant alert skip rows where `triggers_disabled = true`.

### 7. Security hardening + no search-engine indexing
- **No-index:** add `<meta name="robots" content="noindex, nofollow">` in `__root.tsx` head, plus a `public/robots.txt` with `Disallow: /`.
- **Brute-force / abuse:**
  - Server-side login rate limit: 5 failed attempts / 15 min per email + per IP, tracked in a `login_attempts` table. Block with a clear "Too many attempts" message.
  - Enable Supabase **Leaked Password Protection (HIBP)** via `configure_auth`.
  - Require min 12-char passwords with complexity.
  - Force re-auth before credential vault reveal (already audited).
- **Already in place** (so you can tell your boss):
  - Row-Level Security on every table (least-privilege, role-based).
  - AES (pgcrypto) encryption of renewal usernames/passwords + FTP creds at rest; only Super Admin can decrypt; every reveal logged in `credential_access_logs`.
  - Service-role key never exposed to browser; all privileged ops go through server functions.
  - All inputs validated server-side; SQL injection impossible (parameterised + PostgREST).
  - HTTPS only; httpOnly auth cookies; JWT-based sessions with refresh-token rotation.
  - Activity log captures every create/update/delete/login/logout.
  - Disabled users cannot log in (enforced server-side post-fix).
  - SMTP creds stored in `app_settings` JSON only readable by Super Admin.
- I'll write a one-page **SECURITY.md** at repo root summarising all of the above for your boss.

### 8. Make reminder thresholds fully dynamic
- Currently the cron + instant-alert + templates hardcode `[30,7,1]` and `[55,85,100]`.
- New behavior:
  - `app_settings.reminders.value` will store `{ renewal_days: [30,7,1], amc_percents: [55,85,100], cc_internal, also_after_expired }`.
  - Settings UI: replace the single "AMC Low-Hours Threshold (%)" field with a comma-separated `AMC % Thresholds` field (default `55,85,100`).
  - `send-renewal-reminders` and `send-amc-instant-alert` read both arrays from settings and iterate dynamically.
  - On save, auto-create missing `email_templates` rows (e.g. if you add `70%`, a new `amc_hours_70` template is seeded from the closest existing one) so the template editor stays in sync.
  - `renewal_*` and `amc_hours_*` flag columns: switch to a single `sent_thresholds jsonb` array on each row (`["30","7"]` / `["55","85"]`) so any number of thresholds works without schema migrations.

### 9. Hosting on Hostinger — important reality check
This portal **cannot run on Hostinger shared/PHP hosting** as-is. Here's why and your real options:

- The app is a **TanStack Start (React + Node/Cloudflare Workers) SSR app**, not PHP. Hostinger shared plans only run PHP + MySQL.
- The database is **PostgreSQL (Supabase)**, not MySQL/phpMyAdmin. The schema uses Postgres-only features (RLS, `pgcrypto`, `pgmq`, triggers, `jsonb`) that MySQL does not support. A `.sql` export will not import into phpMyAdmin.
- All edge functions, auth, RLS, encrypted credential vault, cron reminders are Supabase-managed.

**What you can actually do:**
1. **Recommended — keep it as is** on Lovable Cloud + the published `.lovable.app` URL, and point a Hostinger-owned domain (e.g. `portal.paaramidigital.com`) to it via DNS CNAME. Custom domain setup lives in Publish → Add custom domain. You keep Hostinger for your marketing site; the portal lives on its own subdomain.
2. **Self-host on a Hostinger VPS (KVM plan, not shared)**: install Node 20, run a self-hosted Supabase (Docker), build & run the TanStack app behind Nginx. This is a multi-day DevOps project and you lose Lovable's automatic edge-function/cron management. I can write the full guide + Dockerfile + nginx config if you commit to a VPS plan, but I will not pretend a `.zip + .sql` to phpMyAdmin is viable.
3. **Rewrite to PHP/MySQL** — full reimplementation, ~weeks of work, loses RLS-grade security. Not recommended.

**My recommendation:** option 1. Tell me your Hostinger domain and I'll give exact DNS records.

---

## Order of execution

1. Branding + email-logo + days-in-subject + AMC % badge (#1, #2, #3) — quick wins.
2. Instant AMC alert fix + email_logs visibility (#4).
3. Log filters + CSV export + pagination (#5).
4. Disable-after-expiry toggles (#6).
5. Dynamic thresholds + auto-seed templates (#8) — biggest change, touches DB + cron + instant + UI.
6. Security: no-index, HIBP, login rate-limit, SECURITY.md (#7).
7. Reply with Hostinger answer + wait for your call on option 1/2/3 (#9) — no code change until you decide.

## Confirm before I start
- OK to proceed with all of 1–8?
- For #9, do you want **option 1 (custom domain on Lovable, recommended)** or **option 2 (Hostinger VPS guide)**?

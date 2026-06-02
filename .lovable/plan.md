## Plan — 6 items

### 1. Full Database Backup / Restore (Super Admin only)
- New route `src/routes/_app/backup.tsx` (Super Admin only).
- Two server functions in `src/lib/backup.functions.ts`:
  - `exportDatabase` — uses `supabaseAdmin` to dump every public table (clients, renewals, amc_clients, time_entries, user_profiles, email_templates, email_logs, reminder_logs, activity_logs, credential_access_logs, app_settings, custom_roles) into a single JSON. `bytea` encrypted columns are base64-encoded so they round-trip. Returns a downloadable JSON blob named `paarami-backup-YYYY-MM-DD.json`.
  - `importDatabase` — accepts the same JSON, validates shape, wipes + re-inserts each table in dependency order inside a transaction. Encrypted columns are decoded back to bytea. Optional "merge" mode (upsert by id) vs "replace" mode.
- UI: Export button (download), Import file picker with big red confirmation dialog, last-backup timestamp shown.

### 2. Logs — date filters, sort, retention guarantee
- Add date-range filter + quick presets (Today / 7d / 30d / 90d / Custom) + single-date picker on **Email Log**, **Reminder Log**, **Activity Log** tabs in `settings.tsx`.
- Server-side pagination (50/page) with `range()` so 5–10 yr histories don't choke the browser. Sort by `created_at desc` default; sortable column headers.
- Add CSV export per filter.
- Add `mem://constraints/no-log-pruning.md` rule: never auto-delete from logs tables. Verify no cron job prunes them. Document in SECURITY.md too.
- Add indexes on `(created_at desc)` on the three log tables to keep queries cheap.

### 3. Custom Roles
- New table `public.custom_roles (id, name, label, created_by, created_at)`. RLS: Super Admin only.
- `user_profiles.role` stays `app_role` enum for built-in (`super_admin`, `manager`); add `custom_role_id uuid` nullable referencing `custom_roles`.
- `has_role` continues to work for built-ins; UI treats custom roles as non-privileged (same perms as manager).
- New "Roles" tab inside User Management: list + create/delete custom roles (Developer, Founder, HR, BD…).
- Invite User dropdown now shows: Super Admin, Manager, + all custom roles.

### 4. Confirmation dialog when disabling email triggers
- On both renewals and AMC bell toggles, when switching OFF, show `AlertDialog` (red destructive variant): "Disable email triggers? No automatic emails (client or internal) will be sent for this entry until you re-enable."
- Switching ON sends a brief success toast — no confirm needed.

### 5. Reset Password edge function error
- Root cause: `admin-create-user` route handles reset but Supabase returns 422 when the new password fails the HIBP / min-length policy. The function bubbles the raw error, surfaced as "non-2xx".
- Fix: in `admin-create-user/index.ts` reset branch, return `{ success:false, error: humanReadable }` with `status: 200` so the client toast shows the real reason instead of a generic edge error.
- Frontend (`users.tsx`) reads `data.error` and shows it in the toast (validation error message: "Password too short", "Password found in breach DB", etc.).

### 6. Fully dynamic Reminders (renewal days + AMC %)
- Schema: `app_settings.reminders.value` becomes:
  ```json
  { "renewal_days":[30,7,1], "amc_percents":[55,85,100],
    "cc_internal":"…", "send_after_expiry":true }
  ```
  (Replaces the legacy single `low_hours_threshold` 20%.)
- Settings UI: replace "AMC Low-Hours Threshold (%)" single field with **AMC % Thresholds (CSV)** field defaulted to `55,85,100`. Tooltip explains.
- Schema migration: drop per-threshold boolean flags (`reminder_55_sent`, `reminder_85_sent`, `reminder_100_sent`, `reminder_30_sent`, etc.) in favour of a single `sent_thresholds jsonb` array per row (e.g. `[30,7]` or `[55,85]`). Reset trigger clears the array.
- Both edge functions (`send-renewal-reminders`, `send-amc-instant-alert`) read both arrays dynamically, iterate, and check `sent_thresholds` for dedup.
- On Save in Settings, auto-create missing `email_templates` rows (`renewal_<n>`, `amc_hours_<pct>`) using the default professional template so a new threshold like `60%` instantly gets an email.
- AMC % usage badge on cards already uses 55/85 ranges — switch to read the configured thresholds.

### Execution order
1. (#5) Reset password fix — small, high value.
2. (#4) Confirmation dialog — quick.
3. (#3) Custom roles — migration + UI.
4. (#6) Dynamic reminders — biggest refactor.
5. (#2) Log filters + retention guarantee.
6. (#1) DB backup/restore.

Total: 1 migration bundle, ~10 file edits, 1 new route, 1 new lib. No external secrets needed.

Reply **"go"** to start, or tell me which items to skip / reorder.

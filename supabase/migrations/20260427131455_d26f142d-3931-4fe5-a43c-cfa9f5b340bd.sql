-- =========================================================
-- EXTENSIONS
-- =========================================================
create extension if not exists pgcrypto;
create extension if not exists pg_net;

-- =========================================================
-- ENUMS
-- =========================================================
create type public.app_role as enum ('super_admin', 'manager');
create type public.client_type as enum ('internal', 'external');
create type public.renewal_status as enum ('active', 'expiring_soon', 'expiring_critical', 'expired');
create type public.amc_status as enum ('active', 'inactive', 'expired', 'hours_exhausted');
create type public.time_entry_status as enum ('pending', 'approved', 'rejected');

-- =========================================================
-- USER PROFILES (linked 1:1 with auth.users)
-- =========================================================
create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role public.app_role not null default 'manager',
  is_active boolean not null default true,
  last_login timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Security-definer role check (avoids RLS recursion)
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_profiles
    where id = _user_id and role = _role and is_active = true
  );
$$;

create or replace function public.is_active_user(_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists(select 1 from public.user_profiles where id = _user_id and is_active = true);
$$;

create or replace function public.current_user_role()
returns public.app_role
language sql stable security definer set search_path = public
as $$
  select role from public.user_profiles where id = auth.uid();
$$;

-- =========================================================
-- updated_at trigger helper
-- =========================================================
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;

create trigger trg_user_profiles_updated_at
  before update on public.user_profiles
  for each row execute function public.tg_set_updated_at();

-- =========================================================
-- CLIENTS
-- =========================================================
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  primary_contact text,
  primary_email text,
  primary_phone text,
  contacts jsonb not null default '[]'::jsonb, -- array of {name,email,phone,role}
  billing_contact text,
  billing_email text,
  address text,
  client_type public.client_type not null default 'external',
  notes text,
  created_by uuid references public.user_profiles(id),
  updated_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_clients_company on public.clients (lower(company_name));
create index idx_clients_type on public.clients (client_type);
create trigger trg_clients_updated_at before update on public.clients
  for each row execute function public.tg_set_updated_at();

-- =========================================================
-- RENEWALS
-- =========================================================
create table public.renewals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  domain text not null,
  service_type text, -- 'D','H','GA','D + H','D + H + GA','D + H + SSL', etc.
  ownership text,   -- 'Internal','Domain + Hosting Client','Hosting Client','Domain + GA Client', etc.
  registrar text,
  hosting_provider text,
  domain_expiry date,
  hosting_expiry date,
  ga_expiry date,
  mail_type text,
  email_count integer,
  contact_person text,
  contact_emails text[] not null default '{}',
  phone_1 text,
  phone_2 text,
  client_type public.client_type not null default 'external',
  notes text,
  -- encrypted credential blobs (pgp_sym_encrypt / decrypt via vault key)
  admin_url text,
  username_enc bytea,
  password_enc bytea,
  panel_type text,
  ftp_host text,
  ftp_username_enc bytea,
  ftp_password_enc bytea,
  ftp_port integer,
  -- reminder flags per expiry kind (domain/hosting/ga share same flags? we store per-record)
  reminder_30_sent boolean not null default false,
  reminder_7_sent boolean not null default false,
  reminder_1_sent boolean not null default false,
  reminder_expired_sent boolean not null default false,
  created_by uuid references public.user_profiles(id),
  updated_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index uq_renewals_domain_lower on public.renewals (lower(domain));
create index idx_renewals_client on public.renewals (client_id);
create index idx_renewals_domain_expiry on public.renewals (domain_expiry);
create index idx_renewals_hosting_expiry on public.renewals (hosting_expiry);

create trigger trg_renewals_updated_at before update on public.renewals
  for each row execute function public.tg_set_updated_at();

-- Reset reminder flags when any expiry date changes
create or replace function public.tg_reset_reminder_flags()
returns trigger language plpgsql as $$
begin
  if (new.domain_expiry is distinct from old.domain_expiry)
     or (new.hosting_expiry is distinct from old.hosting_expiry)
     or (new.ga_expiry is distinct from old.ga_expiry) then
    new.reminder_30_sent := false;
    new.reminder_7_sent := false;
    new.reminder_1_sent := false;
    new.reminder_expired_sent := false;
  end if;
  return new;
end; $$;
create trigger trg_renewals_reset_reminders
  before update on public.renewals
  for each row execute function public.tg_reset_reminder_flags();

-- =========================================================
-- AMC CLIENTS
-- =========================================================
create table public.amc_clients (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  website text,
  bd_person text,
  start_date date not null,
  end_date date not null,
  allocated_hours numeric(8,2) not null default 0,
  consumed_hours numeric(8,2) not null default 0,
  is_active boolean not null default true,
  notes text,
  created_by uuid references public.user_profiles(id),
  updated_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_amc_client on public.amc_clients (client_id);
create trigger trg_amc_updated_at before update on public.amc_clients
  for each row execute function public.tg_set_updated_at();

-- =========================================================
-- TIME ENTRIES
-- =========================================================
create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  amc_client_id uuid not null references public.amc_clients(id) on delete cascade,
  developer_name text not null,
  entry_date date not null default current_date,
  work_description text not null,
  hours integer not null default 0 check (hours between 0 and 23),
  minutes integer not null default 0 check (minutes between 0 and 59),
  is_billable boolean not null default true,
  status public.time_entry_status not null default 'approved',
  created_by uuid references public.user_profiles(id),
  updated_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_time_entries_amc on public.time_entries (amc_client_id);
create index idx_time_entries_date on public.time_entries (entry_date);
create trigger trg_time_entries_updated_at before update on public.time_entries
  for each row execute function public.tg_set_updated_at();

-- Recompute AMC consumed_hours from approved time entries
create or replace function public.tg_recompute_amc_hours()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target_amc uuid;
begin
  target_amc := coalesce(new.amc_client_id, old.amc_client_id);
  update public.amc_clients
     set consumed_hours = coalesce((
       select sum(hours + minutes/60.0)
       from public.time_entries
       where amc_client_id = target_amc and status = 'approved'
     ), 0)
   where id = target_amc;
  return null;
end; $$;
create trigger trg_time_entries_recompute
  after insert or update or delete on public.time_entries
  for each row execute function public.tg_recompute_amc_hours();

-- =========================================================
-- CREDENTIAL ACCESS LOGS
-- =========================================================
create table public.credential_access_logs (
  id uuid primary key default gen_random_uuid(),
  renewal_id uuid not null references public.renewals(id) on delete cascade,
  accessed_by uuid not null references public.user_profiles(id),
  accessed_at timestamptz not null default now(),
  ip_address text,
  user_agent text
);
create index idx_cred_logs_renewal on public.credential_access_logs (renewal_id);

-- =========================================================
-- ACTIVITY LOGS
-- =========================================================
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.user_profiles(id),
  action_type text not null, -- 'login','create','update','delete','view_credential', etc.
  entity_type text,          -- 'client','renewal','amc_client','time_entry','user','settings'
  entity_id uuid,
  description text,
  metadata jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);
create index idx_activity_user on public.activity_logs (user_id);
create index idx_activity_created on public.activity_logs (created_at desc);

-- =========================================================
-- EMAIL TEMPLATES
-- =========================================================
create table public.email_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique, -- 'renewal_30','renewal_7','renewal_1','renewal_expired','amc_low','amc_exhausted'
  subject text not null,
  html_body text not null,
  updated_by uuid references public.user_profiles(id),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- REMINDER LOGS
-- =========================================================
create table public.reminder_logs (
  id uuid primary key default gen_random_uuid(),
  renewal_id uuid references public.renewals(id) on delete cascade,
  reminder_type text not null, -- 'renewal_30' etc.
  sent_at timestamptz not null default now(),
  sent_to text[] not null default '{}',
  status text not null, -- 'sent' | 'failed'
  error_message text,
  expiry_kind text -- 'domain'|'hosting'|'ga'
);
create index idx_reminder_logs_renewal on public.reminder_logs (renewal_id);

-- =========================================================
-- APP SETTINGS
-- =========================================================
create table public.app_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.user_profiles(id),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- ENCRYPTION HELPERS (pgcrypto symmetric)
-- key fetched from app_settings -> 'crypto_key'. Falls back to a generated default.
-- =========================================================
create or replace function public.get_crypto_key()
returns text language plpgsql security definer set search_path = public as $$
declare k text;
begin
  select value->>'key' into k from public.app_settings where key = 'crypto_key';
  if k is null or length(k) < 16 then
    k := encode(gen_random_bytes(32), 'hex');
    insert into public.app_settings(key, value) values ('crypto_key', jsonb_build_object('key', k))
      on conflict (key) do nothing;
    select value->>'key' into k from public.app_settings where key = 'crypto_key';
  end if;
  return k;
end; $$;

create or replace function public.enc_text(plain text)
returns bytea language plpgsql security definer set search_path = public as $$
begin
  if plain is null or plain = '' then return null; end if;
  return pgp_sym_encrypt(plain, public.get_crypto_key());
end; $$;

create or replace function public.dec_text(cipher bytea)
returns text language plpgsql security definer set search_path = public as $$
begin
  if cipher is null then return null; end if;
  return pgp_sym_decrypt(cipher, public.get_crypto_key());
end; $$;

-- Server-side accessor: returns decrypted credentials only to active super_admins, and logs the access
create or replace function public.get_renewal_credentials(_renewal_id uuid)
returns table (
  admin_url text,
  username text,
  password text,
  panel_type text,
  ftp_host text,
  ftp_username text,
  ftp_password text,
  ftp_port integer
)
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if not public.has_role(uid, 'super_admin') then
    raise exception 'Forbidden: Super Admin only';
  end if;

  insert into public.credential_access_logs(renewal_id, accessed_by) values (_renewal_id, uid);
  insert into public.activity_logs(user_id, action_type, entity_type, entity_id, description)
    values (uid, 'view_credential', 'renewal', _renewal_id, 'Viewed credentials');

  return query
    select r.admin_url,
           public.dec_text(r.username_enc),
           public.dec_text(r.password_enc),
           r.panel_type,
           r.ftp_host,
           public.dec_text(r.ftp_username_enc),
           public.dec_text(r.ftp_password_enc),
           r.ftp_port
    from public.renewals r where r.id = _renewal_id;
end; $$;

-- Helper to set encrypted credential fields from plaintext
create or replace function public.set_renewal_credentials(
  _renewal_id uuid,
  _admin_url text,
  _username text,
  _password text,
  _panel_type text,
  _ftp_host text,
  _ftp_username text,
  _ftp_password text,
  _ftp_port integer
) returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if not public.is_active_user(uid) then raise exception 'Inactive user'; end if;

  update public.renewals
     set admin_url = _admin_url,
         username_enc = case when _username is null or _username = '' then null else public.enc_text(_username) end,
         password_enc = case when _password is null or _password = '' then null else public.enc_text(_password) end,
         panel_type = _panel_type,
         ftp_host = _ftp_host,
         ftp_username_enc = case when _ftp_username is null or _ftp_username = '' then null else public.enc_text(_ftp_username) end,
         ftp_password_enc = case when _ftp_password is null or _ftp_password = '' then null else public.enc_text(_ftp_password) end,
         ftp_port = _ftp_port,
         updated_by = uid
   where id = _renewal_id;
end; $$;

-- =========================================================
-- AUTO-PROFILE on new auth user (admins create users via edge fn; but ensure safety net)
-- =========================================================
create or replace function public.tg_handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_profiles (id, full_name, email, role, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'manager'),
    true
  )
  on conflict (id) do nothing;
  return new;
end; $$;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.tg_handle_new_auth_user();

-- =========================================================
-- ENABLE RLS + POLICIES
-- =========================================================
alter table public.user_profiles enable row level security;
alter table public.clients enable row level security;
alter table public.renewals enable row level security;
alter table public.amc_clients enable row level security;
alter table public.time_entries enable row level security;
alter table public.credential_access_logs enable row level security;
alter table public.activity_logs enable row level security;
alter table public.email_templates enable row level security;
alter table public.reminder_logs enable row level security;
alter table public.app_settings enable row level security;

-- user_profiles: users can read all profiles (needed to display names); only super_admin can mutate
create policy up_select_all on public.user_profiles for select to authenticated using (true);
create policy up_update_self_name on public.user_profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.user_profiles where id = auth.uid()));
create policy up_admin_all on public.user_profiles for all to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

-- clients: any active authenticated user can CRUD
create policy clients_select on public.clients for select to authenticated using (public.is_active_user(auth.uid()));
create policy clients_insert on public.clients for insert to authenticated with check (public.is_active_user(auth.uid()));
create policy clients_update on public.clients for update to authenticated using (public.is_active_user(auth.uid())) with check (public.is_active_user(auth.uid()));
create policy clients_delete on public.clients for delete to authenticated using (public.has_role(auth.uid(),'super_admin'));

-- renewals: same pattern; encrypted columns are bytea so even if read, ciphertext is opaque.
create policy renewals_select on public.renewals for select to authenticated using (public.is_active_user(auth.uid()));
create policy renewals_insert on public.renewals for insert to authenticated with check (public.is_active_user(auth.uid()));
create policy renewals_update on public.renewals for update to authenticated using (public.is_active_user(auth.uid())) with check (public.is_active_user(auth.uid()));
create policy renewals_delete on public.renewals for delete to authenticated using (public.has_role(auth.uid(),'super_admin'));

-- amc_clients
create policy amc_select on public.amc_clients for select to authenticated using (public.is_active_user(auth.uid()));
create policy amc_insert on public.amc_clients for insert to authenticated with check (public.is_active_user(auth.uid()));
create policy amc_update on public.amc_clients for update to authenticated using (public.is_active_user(auth.uid())) with check (public.is_active_user(auth.uid()));
create policy amc_delete on public.amc_clients for delete to authenticated using (public.has_role(auth.uid(),'super_admin'));

-- time_entries
create policy te_select on public.time_entries for select to authenticated using (public.is_active_user(auth.uid()));
create policy te_insert on public.time_entries for insert to authenticated with check (public.is_active_user(auth.uid()));
create policy te_update on public.time_entries for update to authenticated using (public.is_active_user(auth.uid())) with check (public.is_active_user(auth.uid()));
create policy te_delete on public.time_entries for delete to authenticated using (public.is_active_user(auth.uid()));

-- credential access logs: super_admin only
create policy cal_admin on public.credential_access_logs for all to authenticated
  using (public.has_role(auth.uid(),'super_admin'))
  with check (public.has_role(auth.uid(),'super_admin'));

-- activity logs: super_admin read; any active user can insert (for own actions)
create policy al_select on public.activity_logs for select to authenticated using (public.has_role(auth.uid(),'super_admin'));
create policy al_insert on public.activity_logs for insert to authenticated with check (auth.uid() = user_id and public.is_active_user(auth.uid()));

-- email templates: super_admin manage; all authenticated read
create policy et_select on public.email_templates for select to authenticated using (public.is_active_user(auth.uid()));
create policy et_admin on public.email_templates for all to authenticated
  using (public.has_role(auth.uid(),'super_admin'))
  with check (public.has_role(auth.uid(),'super_admin'));

-- reminder logs: super_admin only read
create policy rl_select on public.reminder_logs for select to authenticated using (public.has_role(auth.uid(),'super_admin'));

-- app_settings: super_admin only (crypto_key / SMTP secrets must never be readable by managers)
create policy as_admin on public.app_settings for all to authenticated
  using (public.has_role(auth.uid(),'super_admin'))
  with check (public.has_role(auth.uid(),'super_admin'));

-- =========================================================
-- DEFAULT EMAIL TEMPLATES + SETTINGS
-- =========================================================
insert into public.email_templates (template_key, subject, html_body) values
  ('renewal_30', 'Reminder: {{domain}} expires in {{days_remaining}} days',
   '<p>Hello {{contact_name}},</p><p>Your <strong>{{service_type}}</strong> for <strong>{{domain}}</strong> ({{client_name}}) will expire on <strong>{{expiry_date}}</strong> (in {{days_remaining}} days).</p><p>Please take action to renew it on time.</p><p>Thanks,<br/>{{company_name}}</p>'),
  ('renewal_7', 'Action Required: {{domain}} expires in {{days_remaining}} days',
   '<p>Hello {{contact_name}},</p><p><strong>{{domain}}</strong> ({{service_type}}) expires on <strong>{{expiry_date}}</strong> — only {{days_remaining}} days left.</p><p>Please renew immediately to avoid disruption.</p><p>Thanks,<br/>{{company_name}}</p>'),
  ('renewal_1', 'URGENT: {{domain}} expires tomorrow',
   '<p>Hello {{contact_name}},</p><p><strong>{{domain}}</strong> ({{service_type}}) expires <strong>tomorrow</strong>, {{expiry_date}}. Please renew immediately.</p><p>Thanks,<br/>{{company_name}}</p>'),
  ('renewal_expired', 'EXPIRED: {{domain}} expired today',
   '<p>Hello {{contact_name}},</p><p><strong>{{domain}}</strong> ({{service_type}}) has expired on <strong>{{expiry_date}}</strong>. Please renew at the earliest.</p><p>Thanks,<br/>{{company_name}}</p>')
on conflict (template_key) do nothing;

insert into public.app_settings (key, value) values
  ('general', jsonb_build_object('portal_name','Paarami Renewal Manager','company_name','Paarami Digital','admin_emails', jsonb_build_array())),
  ('reminder_rules', jsonb_build_object('enabled_30',true,'enabled_7',true,'enabled_1',true,'enabled_expired',true,'send_hour',9)),
  ('smtp', jsonb_build_object('host','','port',587,'username','','password','','encryption','TLS','from_name','Paarami Renewal Manager','from_email','')),
  ('amc_alerts', jsonb_build_object('warning_pct',70,'critical_pct',90,'email_alerts',true))
on conflict (key) do nothing;
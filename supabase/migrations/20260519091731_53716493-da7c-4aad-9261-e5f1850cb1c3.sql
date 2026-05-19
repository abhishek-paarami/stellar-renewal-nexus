
create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  sent_at timestamptz not null default now(),
  email_type text not null,           -- 'test', 'renewal_reminder', etc.
  to_addresses text[] not null default '{}',
  cc_addresses text[] not null default '{}',
  subject text,
  status text not null,               -- 'success' | 'failed'
  smtp_response text,
  error_message text,
  related_entity text,
  related_id uuid,
  triggered_by uuid
);

create index if not exists idx_email_logs_sent_at on public.email_logs (sent_at desc);
create index if not exists idx_email_logs_status on public.email_logs (status);

alter table public.email_logs enable row level security;

drop policy if exists "email_logs super admin read" on public.email_logs;
create policy "email_logs super admin read"
on public.email_logs for select
to authenticated
using (public.has_role(auth.uid(), 'super_admin'));

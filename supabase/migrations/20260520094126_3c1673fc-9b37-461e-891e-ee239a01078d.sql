
alter table public.amc_clients
  add column if not exists notify_emails text[] default '{}'::text[],
  add column if not exists reminder_55_sent boolean not null default false,
  add column if not exists reminder_85_sent boolean not null default false,
  add column if not exists reminder_100_sent boolean not null default false,
  add column if not exists reminder_expired_sent boolean not null default false;

create or replace function public.tg_reset_amc_reminder_flags()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.allocated_hours is distinct from old.allocated_hours)
     or (new.end_date is distinct from old.end_date) then
    new.reminder_55_sent := false;
    new.reminder_85_sent := false;
    new.reminder_100_sent := false;
    new.reminder_expired_sent := false;
  end if;
  return new;
end; $$;

drop trigger if exists amc_reset_reminders on public.amc_clients;
create trigger amc_reset_reminders
before update on public.amc_clients
for each row execute function public.tg_reset_amc_reminder_flags();

insert into public.email_templates (template_key, subject, html_body) values
('amc_hours_55',
 'AMC update for {{client_name}} — 55% of support hours used',
 '<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:auto;background:#fff;padding:32px;border:1px solid #eee;border-radius:12px"><h2 style="color:#0f172a;margin:0 0 8px">AMC hours update</h2><p style="color:#475569">Hi {{contact_person}},</p><p style="color:#475569">This is a friendly update for the AMC of <b>{{client_name}}</b>. You have currently used <b>{{used_hours}} of {{allocated_hours}} hours</b> ({{usage_pct}}%). <b>{{remaining_hours}} hours</b> remain in this cycle (valid until {{end_date}}).</p><p style="color:#475569">No action is required yet — this is a courtesy notice so you can plan ahead.</p><p style="margin-top:24px;color:#94a3b8;font-size:12px">© Paarami Digital · AMC Support</p></div>'),
('amc_hours_85',
 'Action recommended: 85% of AMC hours used for {{client_name}}',
 '<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:auto;background:#fff;padding:32px;border:1px solid #eee;border-radius:12px"><h2 style="color:#b45309;margin:0 0 8px">85% of AMC hours used</h2><p style="color:#475569">Hi {{contact_person}},</p><p style="color:#475569">Your AMC for <b>{{client_name}}</b> has consumed <b>{{used_hours}} of {{allocated_hours}} hours</b> ({{usage_pct}}%). Only <b>{{remaining_hours}} hours</b> remain (cycle ends {{end_date}}).</p><p style="color:#475569">We recommend reviewing pending tasks and considering an AMC top-up so support stays uninterrupted.</p><p style="margin-top:24px;color:#94a3b8;font-size:12px">© Paarami Digital · AMC Support</p></div>'),
('amc_hours_100',
 'URGENT: AMC hours for {{client_name}} are fully consumed',
 '<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:auto;background:#fff;padding:32px;border:1px solid #fee2e2;border-radius:12px"><h2 style="color:#b91c1c;margin:0 0 8px">AMC hours exhausted</h2><p style="color:#475569">Hi {{contact_person}},</p><p style="color:#475569">The AMC for <b>{{client_name}}</b> has used <b>{{used_hours}} of {{allocated_hours}} hours</b> ({{usage_pct}}%). Your allocated hours for this cycle are now fully consumed.</p><p style="color:#475569">Please reach out to your account manager to renew or top-up so we can continue supporting you without delay.</p><p style="margin-top:24px;color:#94a3b8;font-size:12px">© Paarami Digital · AMC Support</p></div>')
on conflict (template_key) do update
  set subject = excluded.subject,
      html_body = excluded.html_body;

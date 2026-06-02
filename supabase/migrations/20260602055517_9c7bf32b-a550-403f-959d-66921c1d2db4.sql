-- 1) Custom roles
CREATE TABLE IF NOT EXISTS public.custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  label text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.custom_roles TO authenticated;
GRANT ALL ON public.custom_roles TO service_role;

ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY cr_select ON public.custom_roles FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()));
CREATE POLICY cr_admin  ON public.custom_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS custom_role_id uuid REFERENCES public.custom_roles(id) ON DELETE SET NULL;

-- 2) Dynamic threshold tracking
ALTER TABLE public.renewals
  ADD COLUMN IF NOT EXISTS sent_thresholds jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.amc_clients
  ADD COLUMN IF NOT EXISTS sent_thresholds jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Reset sent_thresholds when dates/hours change (extends existing reset triggers)
CREATE OR REPLACE FUNCTION public.tg_reset_reminder_flags()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
begin
  if (new.domain_expiry is distinct from old.domain_expiry)
     or (new.hosting_expiry is distinct from old.hosting_expiry)
     or (new.ga_expiry is distinct from old.ga_expiry) then
    new.reminder_30_sent := false;
    new.reminder_7_sent := false;
    new.reminder_1_sent := false;
    new.reminder_expired_sent := false;
    new.sent_thresholds := '{}'::jsonb;
  end if;
  return new;
end; $function$;

CREATE OR REPLACE FUNCTION public.tg_reset_amc_reminder_flags()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
begin
  if (new.allocated_hours is distinct from old.allocated_hours)
     or (new.end_date is distinct from old.end_date) then
    new.reminder_55_sent := false;
    new.reminder_85_sent := false;
    new.reminder_100_sent := false;
    new.reminder_expired_sent := false;
    new.sent_thresholds := '[]'::jsonb;
  end if;
  return new;
end; $function$;

-- 3) Log indexes — keep years of history fast
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at      ON public.email_logs    (sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_reminder_logs_sent_at   ON public.reminder_logs (sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_action ON public.activity_logs (user_id, action_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_status_type    ON public.email_logs    (status, email_type);

-- 4) Seed a few starter custom roles so dropdown isn't empty
INSERT INTO public.custom_roles (name, label) VALUES
  ('developer', 'Developer'),
  ('founder',   'Founder'),
  ('hr',        'HR'),
  ('bd',        'BD')
ON CONFLICT (name) DO NOTHING;
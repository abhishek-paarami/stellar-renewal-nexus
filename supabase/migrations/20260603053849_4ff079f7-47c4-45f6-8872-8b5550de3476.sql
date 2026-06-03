-- 1. Fix missing UPDATE grant on user_profiles (was causing "permission denied")
GRANT UPDATE ON public.user_profiles TO authenticated;

-- 2. New table: members per role (used in People Directory dynamic tabs)
CREATE TABLE IF NOT EXISTS public.custom_role_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_role_members TO authenticated;
GRANT ALL ON public.custom_role_members TO service_role;

ALTER TABLE public.custom_role_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY crm_select ON public.custom_role_members
  FOR SELECT TO authenticated USING (is_active_user(auth.uid()));

CREATE POLICY crm_admin ON public.custom_role_members
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_custom_role_members_role ON public.custom_role_members(role_id);
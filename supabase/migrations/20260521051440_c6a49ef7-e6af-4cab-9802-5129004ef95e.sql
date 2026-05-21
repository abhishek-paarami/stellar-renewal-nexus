
-- 1. Fix pgcrypto path so credentials save/read works
ALTER FUNCTION public.get_crypto_key() SET search_path TO public, extensions;
ALTER FUNCTION public.enc_text(text) SET search_path TO public, extensions;
ALTER FUNCTION public.dec_text(bytea) SET search_path TO public, extensions;
ALTER FUNCTION public.get_renewal_credentials(uuid) SET search_path TO public, extensions;
ALTER FUNCTION public.set_renewal_credentials(uuid, text, text, text, text, text, text, text, integer) SET search_path TO public, extensions;

-- 2. Directory tables for Developers + BD Persons (managed by Super Admin)
CREATE TABLE IF NOT EXISTS public.developers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.bd_persons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.developers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_persons ENABLE ROW LEVEL SECURITY;

CREATE POLICY dev_select ON public.developers FOR SELECT TO authenticated USING (public.is_active_user(auth.uid()));
CREATE POLICY dev_admin  ON public.developers FOR ALL    TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

CREATE POLICY bd_select ON public.bd_persons FOR SELECT TO authenticated USING (public.is_active_user(auth.uid()));
CREATE POLICY bd_admin  ON public.bd_persons FOR ALL    TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- 3. Bulk-decrypt RPC so Super Admin export can include credentials
CREATE OR REPLACE FUNCTION public.export_renewal_credentials()
RETURNS TABLE (
  id uuid,
  username text,
  password text,
  ftp_username text,
  ftp_password text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  INSERT INTO public.activity_logs(user_id, action_type, entity_type, description)
    VALUES (auth.uid(),'export','renewal','Bulk-exported credentials');
  RETURN QUERY
    SELECT r.id,
           public.dec_text(r.username_enc),
           public.dec_text(r.password_enc),
           public.dec_text(r.ftp_username_enc),
           public.dec_text(r.ftp_password_enc)
      FROM public.renewals r;
END $$;

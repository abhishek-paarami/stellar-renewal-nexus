
-- 1. Move pgcrypto extension out of public schema
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION pgcrypto SET SCHEMA extensions;

-- 2. Revoke EXECUTE on internal-only SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.get_crypto_key()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enc_text(text)          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.dec_text(bytea)         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at()     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_recompute_amc_hours() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_handle_new_auth_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_reset_reminder_flags()     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_reset_amc_reminder_flags() FROM PUBLIC, anon, authenticated;

-- Also revoke from anon on RPCs that require an authenticated session
REVOKE EXECUTE ON FUNCTION public.get_renewal_credentials(uuid)                              FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_renewal_credentials(uuid,text,text,text,text,text,text,text,integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.export_renewal_credentials()                               FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_user_role()                                        FROM anon;

-- 3. Restrict user_profiles updates to the full_name column only (defence-in-depth
--    against the self-update policy WITH CHECK race).
REVOKE UPDATE ON public.user_profiles FROM authenticated;
GRANT  UPDATE (full_name) ON public.user_profiles TO authenticated;
-- super_admin path goes through the up_admin_all policy using service_role / definer,
-- so keep full access for service_role:
GRANT ALL ON public.user_profiles TO service_role;

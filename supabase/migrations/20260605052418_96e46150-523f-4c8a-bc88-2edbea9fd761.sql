
-- AMC: track which day-based expiry reminders (e.g. 3/1/-1) were already sent
ALTER TABLE public.amc_clients
  ADD COLUMN IF NOT EXISTS sent_date_thresholds jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Reset date reminders when end_date is changed
CREATE OR REPLACE FUNCTION public.tg_reset_amc_date_reminders()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF new.end_date IS DISTINCT FROM old.end_date THEN
    new.sent_date_thresholds := '[]'::jsonb;
  END IF;
  RETURN new;
END $$;

DROP TRIGGER IF EXISTS tg_amc_reset_date_reminders ON public.amc_clients;
CREATE TRIGGER tg_amc_reset_date_reminders
  BEFORE UPDATE ON public.amc_clients
  FOR EACH ROW EXECUTE FUNCTION public.tg_reset_amc_date_reminders();

-- Renewals: platform type (WP / Wix / etc) + a single encrypted JSON blob
-- for the extended credentials (registrar, hosting, panel host/port/protocol).
ALTER TABLE public.renewals
  ADD COLUMN IF NOT EXISTS platform_type text,
  ADD COLUMN IF NOT EXISTS extra_creds_enc bytea;

-- Set the encrypted extra credentials (JSON-encoded)
CREATE OR REPLACE FUNCTION public.set_renewal_extra_creds(
  _renewal_id uuid, _platform_type text, _data_json text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','extensions' AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_active_user(uid) THEN RAISE EXCEPTION 'Inactive user'; END IF;
  UPDATE public.renewals
     SET platform_type = _platform_type,
         extra_creds_enc = CASE
           WHEN _data_json IS NULL OR _data_json = '' OR _data_json = '{}' THEN NULL
           ELSE public.enc_text(_data_json)
         END,
         updated_by = uid
   WHERE id = _renewal_id;
END $$;

-- Read decrypted extra credentials (logs access; super_admin only, same as get_renewal_credentials)
CREATE OR REPLACE FUNCTION public.get_renewal_extra_creds(_renewal_id uuid)
RETURNS TABLE(platform_type text, data_json text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','extensions' AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(uid, 'super_admin') THEN
    RAISE EXCEPTION 'Forbidden: Super Admin only';
  END IF;
  RETURN QUERY
    SELECT r.platform_type, public.dec_text(r.extra_creds_enc)
      FROM public.renewals r WHERE r.id = _renewal_id;
END $$;

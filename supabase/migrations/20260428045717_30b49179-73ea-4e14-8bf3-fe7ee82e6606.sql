
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'paarami-renewal-reminders-daily') THEN
    PERFORM cron.unschedule('paarami-renewal-reminders-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'paarami-renewal-reminders-daily',
  '30 3 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://lqrgsnoyuiqxqwekkwcp.supabase.co/functions/v1/send-renewal-reminders',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $cron$
);

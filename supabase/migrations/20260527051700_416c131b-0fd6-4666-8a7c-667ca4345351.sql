
-- 1. Per-row "disable email triggers" toggle
ALTER TABLE public.renewals ADD COLUMN IF NOT EXISTS triggers_disabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.amc_clients ADD COLUMN IF NOT EXISTS triggers_disabled boolean NOT NULL DEFAULT false;

-- 2. Fix subject lines to include {{days_left}}
UPDATE public.email_templates SET subject = 'Action Required: {{domain}} expires in {{days_left}} days' WHERE template_key = 'renewal_30';
UPDATE public.email_templates SET subject = 'Urgent: {{domain}} expires in {{days_left}} days' WHERE template_key = 'renewal_7';
UPDATE public.email_templates SET subject = 'Critical: {{domain}} expires tomorrow' WHERE template_key = 'renewal_1';
UPDATE public.email_templates SET subject = 'EXPIRED: {{domain}} expired {{days_left}} days ago' WHERE template_key = 'renewal_expired';
UPDATE public.email_templates SET subject = '[AMC] {{client_name}} — {{usage_pct}}% hours used (warning)' WHERE template_key = 'amc_hours_55';
UPDATE public.email_templates SET subject = '[AMC] {{client_name}} — {{usage_pct}}% hours used (urgent)' WHERE template_key = 'amc_hours_85';
UPDATE public.email_templates SET subject = '[AMC] {{client_name}} — 100% hours consumed' WHERE template_key = 'amc_hours_100';

-- 3. Replace logo src in all templates with an absolute publicly-hosted URL
UPDATE public.email_templates
SET html_body = regexp_replace(
  html_body,
  'src="https://paaramidigital\.com/wp-content/uploads/2024/05/paarami-logo\.png"',
  'src="https://stellar-renewal-nexus.lovable.app/logo.png" width="140" height="34"',
  'g'
)
WHERE html_body LIKE '%paarami-logo.png%';

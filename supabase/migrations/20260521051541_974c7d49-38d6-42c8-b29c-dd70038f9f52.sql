
-- Professional default templates with logo + red "days left" callout
WITH defs(template_key, subject, html_body) AS (
  VALUES
  ('renewal_30',
    '[Renewal] {{client_name}} — {{service_name}} expires in {{days_left}} days',
    '__BASE__|Renewal reminder|<p>Hi Team,</p><p>The following renewal is approaching its expiry date.</p>__CALLOUT__{{days_left}} day(s) left__ENDCALLOUT__<table style="width:100%;border-collapse:collapse;margin:18px 0;font-size:14px"><tr><td style="padding:6px 0;color:#475569;width:38%">Client</td><td style="padding:6px 0;color:#0f172a;font-weight:600">{{client_name}}</td></tr><tr><td style="padding:6px 0;color:#475569">Service</td><td style="padding:6px 0;color:#0f172a;font-weight:600">{{service_name}}</td></tr><tr><td style="padding:6px 0;color:#475569">Service Type</td><td style="padding:6px 0;color:#0f172a">{{service_type}}</td></tr><tr><td style="padding:6px 0;color:#475569">Expiry Date</td><td style="padding:6px 0;color:#0f172a;font-weight:600">{{expiry_date}}</td></tr><tr><td style="padding:6px 0;color:#475569">Provider</td><td style="padding:6px 0;color:#0f172a">{{service_provider}}</td></tr></table><p>Please initiate the renewal process at the earliest.</p>'),
  ('renewal_7',
    '[Urgent] {{client_name}} — {{service_name}} expires in {{days_left}} days',
    '__BASE__|Urgent renewal action required|<p>Hi Team,</p><p>This service is expiring very soon and requires immediate attention.</p>__CALLOUT__Only {{days_left}} day(s) left__ENDCALLOUT__<table style="width:100%;border-collapse:collapse;margin:18px 0;font-size:14px"><tr><td style="padding:6px 0;color:#475569;width:38%">Client</td><td style="padding:6px 0;color:#0f172a;font-weight:600">{{client_name}}</td></tr><tr><td style="padding:6px 0;color:#475569">Service</td><td style="padding:6px 0;color:#0f172a;font-weight:600">{{service_name}}</td></tr><tr><td style="padding:6px 0;color:#475569">Expiry Date</td><td style="padding:6px 0;color:#0f172a;font-weight:600">{{expiry_date}}</td></tr><tr><td style="padding:6px 0;color:#475569">Provider</td><td style="padding:6px 0;color:#0f172a">{{service_provider}}</td></tr></table>'),
  ('renewal_1',
    '[Critical] {{client_name}} — {{service_name}} expires TOMORROW',
    '__BASE__|Critical: service expires tomorrow|<p>Hi Team,</p>__CALLOUT__1 day left__ENDCALLOUT__<p>The following service expires <strong>tomorrow</strong>. Please renew it today to avoid downtime.</p><table style="width:100%;border-collapse:collapse;margin:18px 0;font-size:14px"><tr><td style="padding:6px 0;color:#475569;width:38%">Client</td><td style="padding:6px 0;color:#0f172a;font-weight:600">{{client_name}}</td></tr><tr><td style="padding:6px 0;color:#475569">Service</td><td style="padding:6px 0;color:#0f172a;font-weight:600">{{service_name}}</td></tr><tr><td style="padding:6px 0;color:#475569">Expiry Date</td><td style="padding:6px 0;color:#0f172a;font-weight:600">{{expiry_date}}</td></tr></table>'),
  ('renewal_expired',
    '[Expired] {{client_name}} — {{service_name}} has expired',
    '__BASE__|Service expired|<p>Hi Team,</p>__CALLOUT__Expired {{days_left}} day(s) ago__ENDCALLOUT__<p>The service below has already expired. Please take action immediately.</p><table style="width:100%;border-collapse:collapse;margin:18px 0;font-size:14px"><tr><td style="padding:6px 0;color:#475569;width:38%">Client</td><td style="padding:6px 0;color:#0f172a;font-weight:600">{{client_name}}</td></tr><tr><td style="padding:6px 0;color:#475569">Service</td><td style="padding:6px 0;color:#0f172a;font-weight:600">{{service_name}}</td></tr><tr><td style="padding:6px 0;color:#475569">Expiry Date</td><td style="padding:6px 0;color:#0f172a;font-weight:600">{{expiry_date}}</td></tr></table>'),
  ('amc_hours_55',
    '[AMC] {{client_name}} — 55% of monthly hours consumed',
    '__BASE__|AMC usage update|<p>Hi Team,</p>__CALLOUT__55% hours consumed__ENDCALLOUT__<p>{{client_name}} has used <strong>{{consumed_hours}}</strong> of <strong>{{monthly_hours}}</strong> hours for {{cycle_month}}.</p>'),
  ('amc_hours_85',
    '[AMC] {{client_name}} — 85% of monthly hours consumed',
    '__BASE__|AMC usage warning|<p>Hi Team,</p>__CALLOUT__85% hours consumed__ENDCALLOUT__<p>{{client_name}} has used <strong>{{consumed_hours}}</strong> of <strong>{{monthly_hours}}</strong> hours for {{cycle_month}}. Please plan accordingly.</p>'),
  ('amc_hours_100',
    '[AMC] {{client_name}} — Monthly hours fully consumed',
    '__BASE__|AMC hours exhausted|<p>Hi Team,</p>__CALLOUT__100% — all hours used__ENDCALLOUT__<p>{{client_name}} has consumed all <strong>{{monthly_hours}}</strong> AMC hours for {{cycle_month}}. Any further work this cycle will be out of scope.</p>'),
  ('welcome_user',
    'Welcome to the Paarami Internal Portal',
    '__BASE__|Your portal access is ready|<p>Hi {{full_name}},</p><p>An account has been created for you on the Paarami Internal Operations Portal.</p><table style="width:100%;border-collapse:collapse;margin:18px 0;font-size:14px"><tr><td style="padding:6px 0;color:#475569;width:38%">Login email</td><td style="padding:6px 0;color:#0f172a;font-weight:600">{{email}}</td></tr><tr><td style="padding:6px 0;color:#475569">Temporary password</td><td style="padding:6px 0;color:#0f172a;font-weight:600">{{temp_password}}</td></tr><tr><td style="padding:6px 0;color:#475569">Portal URL</td><td style="padding:6px 0;color:#0f172a"><a href="{{portal_url}}" style="color:#0f1b3d">{{portal_url}}</a></td></tr></table><p>For your security, please sign in and change your password from <em>Account Settings</em>.</p>')
),
expanded AS (
  SELECT
    template_key,
    subject,
    replace(
      replace(
        replace(
          replace(html_body,
            '__BASE__|',
            '<div style="background:#f1f5f9;padding:28px 0;font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a"><div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,.08)"><div style="background:#0f1b3d;padding:22px 28px;text-align:left"><img src="https://paaramidigital.com/wp-content/uploads/2024/05/paarami-logo.png" alt="Paarami" style="height:34px;display:block"/></div><div style="padding:28px"><h2 style="margin:0 0 6px 0;font-size:18px;color:#0f172a">'
          ),
          '|',
          '</h2><div style="height:3px;width:48px;background:#fabc34;border-radius:2px;margin:0 0 18px 0"></div>'
        ),
        '__CALLOUT__',
        '<div style="background:#fef2f2;border:1px solid #fecaca;border-left:4px solid #dc2626;padding:12px 14px;border-radius:8px;margin:12px 0;color:#991b1b;font-weight:700;font-size:15px">'
      ),
      '__ENDCALLOUT__',
      '</div>'
    ) || '</div><div style="padding:14px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px">This is an automated message from the Paarami Internal Operations Portal.</div></div></div>'
      AS html_body
  FROM defs
)
INSERT INTO public.email_templates (template_key, subject, html_body)
SELECT template_key, subject, html_body FROM expanded
ON CONFLICT (template_key) DO UPDATE
SET subject = EXCLUDED.subject,
    html_body = EXCLUDED.html_body,
    updated_at = now();

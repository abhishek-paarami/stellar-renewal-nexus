// Daily cron-driven reminder dispatcher.
// Walks renewals + AMC clients, picks ones matching configured day-thresholds,
// renders the matching template, sends via SMTP, logs result, flips reminder flag.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendMail, SmtpConfig } from "../_shared/smtp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function daysUntil(d: string): number {
  const t = new Date(d + "T00:00:00Z").getTime();
  return Math.ceil((t - Date.now()) / 86400000);
}

function render(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ""));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const [{ data: smtpRow }, { data: remRow }, { data: tpls }, { data: renewals }, { data: clients }, { data: amcs }] = await Promise.all([
      admin.from("app_settings").select("value").eq("key", "smtp").maybeSingle(),
      admin.from("app_settings").select("value").eq("key", "reminders").maybeSingle(),
      admin.from("email_templates").select("*"),
      admin.from("renewals").select("*"),
      admin.from("clients").select("id, company_name"),
      admin.from("amc_clients").select("*"),
    ]);

    const smtp = (smtpRow?.value || {}) as Partial<SmtpConfig> & { enabled?: boolean };
    if (!smtp.host || !smtp.username || !smtp.password || !smtp.from_email || smtp.enabled === false) {
      return json({ error: "SMTP not configured or disabled", sent: 0 }, 200);
    }

    const cfg: SmtpConfig = {
      host: smtp.host, port: Number(smtp.port) || 587, secure: !!smtp.secure,
      username: smtp.username, password: smtp.password,
      from_email: smtp.from_email, from_name: smtp.from_name,
    };

    const settings = (remRow?.value || {}) as { days_before?: string; send_after_expiry?: boolean; cc_internal?: string };
    const thresholds = (settings.days_before || "30,7,1").split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n));
    const sendExpired = settings.send_after_expiry !== false;
    const cc = (settings.cc_internal || "").split(",").map((s) => s.trim()).filter(Boolean);

    const tplMap: Record<string, { subject: string; html: string }> = {};
    for (const t of tpls || []) tplMap[t.template_key] = { subject: t.subject, html: t.html_body };

    const clientNameMap: Record<string, string> = {};
    for (const c of clients || []) clientNameMap[c.id] = c.company_name;

    const KINDS: Array<{ field: "domain_expiry" | "hosting_expiry" | "ga_expiry"; label: string }> = [
      { field: "domain_expiry", label: "Domain" },
      { field: "hosting_expiry", label: "Hosting" },
      { field: "ga_expiry", label: "Google Apps" },
    ];

    let sent = 0;
    for (const r of renewals || []) {
      const recipients: string[] = (r.contact_emails || []).filter((e: string) => /@/.test(e));
      if (!recipients.length) continue;

      for (const k of KINDS) {
        const date = (r as any)[k.field] as string | null;
        if (!date) continue;
        const d = daysUntil(date);

        let templateKey: string | null = null;
        let flagField: string | null = null;

        if (d < 0 && sendExpired && !r.reminder_expired_sent) {
          templateKey = "renewal_expired"; flagField = "reminder_expired_sent";
        } else if (thresholds.includes(d)) {
          if (d === 30 && !r.reminder_30_sent) { templateKey = "renewal_30"; flagField = "reminder_30_sent"; }
          else if (d === 7 && !r.reminder_7_sent) { templateKey = "renewal_7"; flagField = "reminder_7_sent"; }
          else if (d === 1 && !r.reminder_1_sent) { templateKey = "renewal_1"; flagField = "reminder_1_sent"; }
        }
        if (!templateKey || !flagField) continue;

        const tpl = tplMap[templateKey];
        if (!tpl) continue;

        const providerField =
          k.field === "domain_expiry" ? "domain_provider"
          : k.field === "hosting_expiry" ? "hosting_provider"
          : "ga_provider";
        const provider = (r as any)[providerField] || "";
        const vars = {
          client_name: clientNameMap[r.client_id || ""] || "",
          domain: r.domain,
          expiry_kind: k.label,
          service_name: `${k.label} — ${r.domain || ""}`.trim(),
          service_type: k.label,
          service_provider: provider,
          expiry_date: date,
          days_left: d < 0 ? Math.abs(d) : d,
          contact_person: r.contact_person || "",
        };
        const subject = render(tpl.subject, vars);
        const html = render(tpl.html, vars);

        try {
          const trace: string[] = [];
          await sendMail(cfg, { to: recipients, cc, subject, html }, (l) => trace.push(l));
          sent++;
          await admin.from("renewals").update({ [flagField]: true }).eq("id", r.id);
          await admin.from("reminder_logs").insert({
            renewal_id: r.id, reminder_type: templateKey, expiry_kind: k.label,
            sent_to: recipients, status: "success",
          });
          await admin.from("email_logs").insert({
            email_type: "renewal_reminder", to_addresses: recipients, cc_addresses: cc,
            subject, status: "success", smtp_response: trace.slice(-15).join("\n"),
            related_entity: "renewal", related_id: r.id,
          });
        } catch (err: any) {
          const errMsg = String(err?.message || err);
          await admin.from("reminder_logs").insert({
            renewal_id: r.id, reminder_type: templateKey, expiry_kind: k.label,
            sent_to: recipients, status: "failed", error_message: errMsg,
          });
          await admin.from("email_logs").insert({
            email_type: "renewal_reminder", to_addresses: recipients, cc_addresses: cc,
            subject, status: "failed", error_message: errMsg,
            related_entity: "renewal", related_id: r.id,
          });
        }
      }
    }

    // ---------------- AMC hour-usage reminders ----------------
    for (const a of amcs || []) {
      const allocated = Number(a.allocated_hours || 0);
      const used = Number(a.consumed_hours || 0);
      if (allocated <= 0) continue;

      const recipients: string[] = (a.notify_emails || []).filter((e: string) => /@/.test(e));
      if (!recipients.length) continue;

      const pct = Math.min(100, Math.round((used / allocated) * 100));
      const remaining = Math.max(0, allocated - used);

      type Step = { thr: number; key: string; flag: string };
      const steps: Step[] = [
        { thr: 100, key: "amc_hours_100", flag: "reminder_100_sent" },
        { thr: 85,  key: "amc_hours_85",  flag: "reminder_85_sent"  },
        { thr: 55,  key: "amc_hours_55",  flag: "reminder_55_sent"  },
      ];
      const step = steps.find((s) => pct >= s.thr && !(a as any)[s.flag]);
      if (!step) continue;

      const tpl = tplMap[step.key];
      if (!tpl) continue;

      const vars = {
        client_name: clientNameMap[a.client_id || ""] || "",
        contact_person: a.contact_person || "Team",
        allocated_hours: allocated,
        used_hours: used,
        remaining_hours: remaining,
        usage_pct: pct,
        end_date: a.end_date || "",
        // aliases used by new default templates
        monthly_hours: allocated,
        consumed_hours: used,
        cycle_month: new Date().toLocaleString("en-IN", { month: "long", year: "numeric" }),
      };
      const subject = render(tpl.subject, vars);
      const html = render(tpl.html, vars);

      try {
        const trace: string[] = [];
        await sendMail(cfg, { to: recipients, cc, subject, html }, (l) => trace.push(l));
        sent++;
        await admin.from("amc_clients").update({ [step.flag]: true }).eq("id", a.id);
        await admin.from("email_logs").insert({
          email_type: "amc_reminder", to_addresses: recipients, cc_addresses: cc,
          subject, status: "success", smtp_response: trace.slice(-15).join("\n"),
          related_entity: "amc_client", related_id: a.id,
        });
      } catch (err: any) {
        const errMsg = String(err?.message || err);
        await admin.from("email_logs").insert({
          email_type: "amc_reminder", to_addresses: recipients, cc_addresses: cc,
          subject, status: "failed", error_message: errMsg,
          related_entity: "amc_client", related_id: a.id,
        });
      }
    }

    return json({ success: true, sent });
  } catch (e: any) {
    return json({ error: e.message || String(e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });
}
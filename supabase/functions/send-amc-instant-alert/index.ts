// Fires AMC threshold alerts (55/85/100%) immediately when a time entry is logged.
// Called from the client right after inserting an approved time entry.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendMail, SmtpConfig } from "../_shared/smtp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function render(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ""));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { amc_client_id } = await req.json();
    if (!amc_client_id) return json({ error: "amc_client_id required" }, 400);

    const [{ data: a }, { data: smtpRow }, { data: remRow }, { data: tpls }] = await Promise.all([
      admin.from("amc_clients").select("*, clients(company_name)").eq("id", amc_client_id).maybeSingle(),
      admin.from("app_settings").select("value").eq("key", "smtp").maybeSingle(),
      admin.from("app_settings").select("value").eq("key", "reminders").maybeSingle(),
      admin.from("email_templates").select("*"),
    ]);
    if (!a) return json({ error: "AMC client not found" }, 404);

    const allocated = Number(a.allocated_hours || 0);
    const used = Number(a.consumed_hours || 0);
    if (allocated <= 0) return json({ sent: 0, reason: "no allocation" });

    const pct = Math.min(100, Math.round((used / allocated) * 100));
    type Step = { thr: number; key: string; flag: string };
    const steps: Step[] = [
      { thr: 100, key: "amc_hours_100", flag: "reminder_100_sent" },
      { thr: 85,  key: "amc_hours_85",  flag: "reminder_85_sent"  },
      { thr: 55,  key: "amc_hours_55",  flag: "reminder_55_sent"  },
    ];
    const step = steps.find((s) => pct >= s.thr && !(a as any)[s.flag]);
    if (!step) return json({ sent: 0, reason: "no threshold crossed" });

    const smtp = (smtpRow?.value || {}) as Partial<SmtpConfig> & { enabled?: boolean };
    if (!smtp.host || !smtp.username || !smtp.password || !smtp.from_email || smtp.enabled === false) {
      return json({ error: "SMTP not configured", sent: 0 }, 200);
    }
    const cfg: SmtpConfig = {
      host: smtp.host, port: Number(smtp.port) || 587, secure: !!smtp.secure,
      username: smtp.username, password: smtp.password,
      from_email: smtp.from_email, from_name: smtp.from_name,
    };

    const settings = (remRow?.value || {}) as { cc_internal?: string };
    const cc = (settings.cc_internal || "").split(",").map((s) => s.trim()).filter(Boolean);
    const recipients: string[] = (a.notify_emails || []).filter((e: string) => /@/.test(e));
    if (!recipients.length) return json({ sent: 0, reason: "no recipients" });

    const tplMap: Record<string, { subject: string; html: string }> = {};
    for (const t of tpls || []) tplMap[t.template_key] = { subject: t.subject, html: t.html_body };
    const tpl = tplMap[step.key];
    if (!tpl) return json({ sent: 0, reason: "template missing" });

    const vars = {
      client_name: (a as any).clients?.company_name || "",
      contact_person: a.contact_person || "Team",
      allocated_hours: allocated,
      used_hours: used,
      remaining_hours: Math.max(0, allocated - used),
      usage_pct: pct,
      monthly_hours: allocated,
      consumed_hours: used,
      cycle_month: new Date().toLocaleString("en-IN", { month: "long", year: "numeric" }),
    };
    const subject = render(tpl.subject, vars);
    const html = render(tpl.html, vars);

    try {
      const trace: string[] = [];
      await sendMail(cfg, { to: recipients, cc, subject, html }, (l) => trace.push(l));
      await admin.from("amc_clients").update({ [step.flag]: true }).eq("id", a.id);
      await admin.from("email_logs").insert({
        email_type: "amc_instant", to_addresses: recipients, cc_addresses: cc,
        subject, status: "success", smtp_response: trace.slice(-15).join("\n"),
        related_entity: "amc_client", related_id: a.id,
      });
      return json({ sent: 1, threshold: step.thr });
    } catch (err: any) {
      const errMsg = String(err?.message || err);
      await admin.from("email_logs").insert({
        email_type: "amc_instant", to_addresses: recipients, cc_addresses: cc,
        subject, status: "failed", error_message: errMsg,
        related_entity: "amc_client", related_id: a.id,
      });
      return json({ error: errMsg }, 500);
    }
  } catch (e: any) {
    return json({ error: e.message || String(e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });
}
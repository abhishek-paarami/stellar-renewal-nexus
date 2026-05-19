// Sends a test email using stored SMTP settings.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendMail, SmtpConfig } from "../_shared/smtp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let userId: string | null = null;
  let toAddr: string | null = null;
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: ures } = await userClient.auth.getUser();
    if (!ures?.user) return json({ error: "Not authenticated" }, 401);
    userId = ures.user.id;
    const { data: prof } = await supabase.from("user_profiles").select("role").eq("id", ures.user.id).maybeSingle();
    if (!prof || prof.role !== "super_admin") return json({ error: "Super Admin only" }, 403);

    const { to } = await req.json();
    if (!to) return json({ error: "Missing 'to'" }, 400);
    toAddr = to;

    const { data: s } = await supabase.from("app_settings").select("value").eq("key", "smtp").maybeSingle();
    const cfg = (s?.value || {}) as Partial<SmtpConfig> & { enabled?: boolean };
    const missing = (["host", "username", "password", "from_email"] as const).filter((k) => !cfg[k]);
    if (missing.length) {
      const msg = `SMTP not configured — missing: ${missing.join(", ")}`;
      await logEmail(supabase, { email_type: "test", to: [to], subject: "Paarami Portal — SMTP Test", status: "failed", error: msg, triggered_by: userId });
      return json({ error: msg }, 400);
    }

    const subject = "Paarami Portal — SMTP Test";
    const trace: string[] = [];
    try {
      await sendMail(
        { host: cfg.host!, port: Number(cfg.port) || 587, secure: !!cfg.secure, username: cfg.username!, password: cfg.password!, from_email: cfg.from_email!, from_name: cfg.from_name },
        {
          to: [to],
          subject,
          html: `<div style="font-family:Inter,Arial,sans-serif;padding:24px;color:#1f2937"><h2 style="margin:0 0 12px">SMTP Configured Successfully ✅</h2><p>This is a test email from the Paarami Renewal & AMC Portal. If you received this, your SMTP settings are working.</p><p style="color:#6b7280;font-size:12px;margin-top:24px">Sent at ${new Date().toISOString()}</p></div>`,
        },
        (line) => trace.push(line),
      );
      await logEmail(supabase, { email_type: "test", to: [to], subject, status: "success", smtp_response: trace.slice(-20).join("\n"), triggered_by: userId });
      return json({ success: true, trace });
    } catch (sendErr: any) {
      const errMsg = sendErr?.message || String(sendErr);
      await logEmail(supabase, { email_type: "test", to: [to], subject, status: "failed", error: errMsg, smtp_response: trace.slice(-20).join("\n"), triggered_by: userId });
      return json({ error: errMsg, trace }, 500);
    }
  } catch (e: any) {
    return json({ error: e.message || String(e) }, 500);
  }
});

async function logEmail(supabase: any, p: { email_type: string; to: string[]; subject: string; status: string; smtp_response?: string; error?: string; triggered_by?: string | null }) {
  try {
    await supabase.from("email_logs").insert({
      email_type: p.email_type,
      to_addresses: p.to,
      subject: p.subject,
      status: p.status,
      smtp_response: p.smtp_response ?? null,
      error_message: p.error ?? null,
      triggered_by: p.triggered_by ?? null,
    });
  } catch (_) { /* swallow */ }
}

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });
}
// Super Admin actions on users:
//  - action="create"  -> create auth user + profile, optionally email welcome
//  - action="reset_password" -> set a new password and email it
//  - action="delete"  -> delete the auth user (cascades profile)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendMail, SmtpConfig } from "../_shared/smtp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function loadSmtp(admin: any): Promise<SmtpConfig | null> {
  const { data } = await admin.from("app_settings").select("value").eq("key", "smtp").maybeSingle();
  const s = (data?.value || {}) as any;
  if (!s.host || !s.username || !s.password || !s.from_email || s.enabled === false) return null;
  return {
    host: s.host, port: Number(s.port) || 587, secure: !!s.secure,
    username: s.username, password: s.password,
    from_email: s.from_email, from_name: s.from_name,
  };
}

function welcomeHtml(full_name: string, email: string, password: string, role: string, portalUrl: string) {
  return `
  <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;background:#fff;padding:32px;border:1px solid #eee;border-radius:12px">
    <h2 style="margin:0 0 8px;color:#0f172a">Welcome to Paarami Portal</h2>
    <p style="color:#475569;margin:0 0 20px">Hi ${full_name}, your access to the Paarami Internal Operations Portal has been created.</p>
    <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:8px;overflow:hidden">
      <tr><td style="padding:12px 16px;color:#64748b;font-size:12px;text-transform:uppercase">Email</td><td style="padding:12px 16px;color:#0f172a;font-weight:600">${email}</td></tr>
      <tr><td style="padding:12px 16px;color:#64748b;font-size:12px;text-transform:uppercase">Temporary password</td><td style="padding:12px 16px;color:#0f172a;font-weight:600;font-family:monospace">${password}</td></tr>
      <tr><td style="padding:12px 16px;color:#64748b;font-size:12px;text-transform:uppercase">Role</td><td style="padding:12px 16px;color:#0f172a;font-weight:600;text-transform:capitalize">${role.replace("_"," ")}</td></tr>
    </table>
    <p style="margin:24px 0 8px;color:#475569">Please sign in and change your password from <b>Profile → Change password</b>.</p>
    <a href="${portalUrl}" style="display:inline-block;margin-top:12px;background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Open Portal</a>
    <p style="margin-top:24px;color:#94a3b8;font-size:12px">© Paarami Digital · Internal use only</p>
  </div>`;
}

function resetHtml(full_name: string, email: string, password: string, portalUrl: string) {
  return `
  <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;background:#fff;padding:32px;border:1px solid #eee;border-radius:12px">
    <h2 style="margin:0 0 8px;color:#0f172a">Password reset</h2>
    <p style="color:#475569;margin:0 0 20px">Hi ${full_name}, your Paarami Portal password has been reset by your Super Admin.</p>
    <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:8px;overflow:hidden">
      <tr><td style="padding:12px 16px;color:#64748b;font-size:12px;text-transform:uppercase">Email</td><td style="padding:12px 16px;color:#0f172a;font-weight:600">${email}</td></tr>
      <tr><td style="padding:12px 16px;color:#64748b;font-size:12px;text-transform:uppercase">New password</td><td style="padding:12px 16px;color:#0f172a;font-weight:600;font-family:monospace">${password}</td></tr>
    </table>
    <p style="margin:24px 0 8px;color:#475569">Sign in and change it immediately from <b>Profile → Change password</b>.</p>
    <a href="${portalUrl}" style="display:inline-block;margin-top:12px;background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Open Portal</a>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: ures } = await userClient.auth.getUser();
    if (!ures?.user) return json({ error: "Not authenticated" }, 401);
    const { data: prof } = await admin.from("user_profiles").select("role").eq("id", ures.user.id).maybeSingle();
    if (!prof || prof.role !== "super_admin") return json({ error: "Super Admin only" }, 403);

    const body = await req.json();
    const action = body.action || "create";
    // Always use the production portal URL so links in emails open the deployed portal,
    // not the lovable preview or dev origin. Super Admin can override via app_settings.portal_url.
    const { data: portalRow } = await admin.from("app_settings").select("value").eq("key", "portal_url").maybeSingle();
    const portalUrl: string =
      (portalRow?.value as any)?.url ||
      "https://stellar-renewal-nexus.lovable.app";

    if (action === "create") {
      const { email, password, full_name, role } = body;
      if (!email || !password || !full_name) return json({ error: "Missing fields" }, 400);
      const { data: created, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { full_name, role: role || "manager" },
      });
      if (error) return json({ error: error.message }, 400);
      await admin.from("user_profiles").upsert({
        id: created.user!.id, email, full_name, role: role || "manager", is_active: true,
      });
      await admin.from("activity_logs").insert({
        user_id: ures.user.id, action_type: "create_user", entity_type: "user_profile",
        entity_id: created.user!.id, description: `Created ${role} ${email}`,
      });
      // Welcome email
      const cfg = await loadSmtp(admin);
      let emailStatus: any = { sent: false };
      if (cfg) {
        const trace: string[] = [];
        try {
          await sendMail(cfg, {
            to: [email],
            subject: "Welcome to Paarami Portal — your access credentials",
            html: welcomeHtml(full_name, email, password, role || "manager", portalUrl),
          }, (l) => trace.push(l));
          emailStatus = { sent: true };
          await admin.from("email_logs").insert({
            email_type: "welcome", to_addresses: [email],
            subject: "Welcome to Paarami Portal", status: "success",
            smtp_response: trace.slice(-15).join("\n"),
            related_entity: "user_profile", related_id: created.user!.id,
          });
        } catch (err: any) {
          emailStatus = { sent: false, error: String(err?.message || err) };
          await admin.from("email_logs").insert({
            email_type: "welcome", to_addresses: [email],
            subject: "Welcome to Paarami Portal", status: "failed",
            error_message: emailStatus.error, smtp_response: trace.slice(-15).join("\n"),
            related_entity: "user_profile", related_id: created.user!.id,
          });
        }
      } else {
        emailStatus = { sent: false, error: "SMTP not configured" };
      }
      return json({ success: true, user_id: created.user!.id, email: emailStatus });
    }

    if (action === "reset_password") {
      const { user_id, password } = body;
      if (!user_id || !password) return json({ success: false, error: "Missing fields" }, 200);
      const { data: target } = await admin.from("user_profiles").select("email, full_name").eq("id", user_id).maybeSingle();
      if (!target) return json({ success: false, error: "User not found" }, 200);
      const { error } = await admin.auth.admin.updateUserById(user_id, { password });
      if (error) {
        // Surface auth-side message (HIBP, length, etc.) with status 200 so the
        // browser SDK doesn't swallow the body as a generic "non-2xx" error.
        await admin.from("activity_logs").insert({
          user_id: ures.user.id, action_type: "reset_password_failed", entity_type: "user_profile",
          entity_id: user_id, description: `Reset password FAILED for ${target.email}: ${error.message}`,
        });
        return json({ success: false, error: error.message }, 200);
      }
      await admin.from("activity_logs").insert({
        user_id: ures.user.id, action_type: "reset_password", entity_type: "user_profile",
        entity_id: user_id, description: `Reset password for ${target.email}`,
      });
      const cfg = await loadSmtp(admin);
      let emailStatus: any = { sent: false };
      if (cfg) {
        const trace: string[] = [];
        try {
          await sendMail(cfg, {
            to: [target.email],
            subject: "Paarami Portal — your password was reset",
            html: resetHtml(target.full_name, target.email, password, portalUrl),
          }, (l) => trace.push(l));
          emailStatus = { sent: true };
          await admin.from("email_logs").insert({
            email_type: "password_reset", to_addresses: [target.email],
            subject: "Password reset", status: "success",
            smtp_response: trace.slice(-15).join("\n"),
            related_entity: "user_profile", related_id: user_id,
          });
        } catch (err: any) {
          emailStatus = { sent: false, error: String(err?.message || err) };
          await admin.from("email_logs").insert({
            email_type: "password_reset", to_addresses: [target.email],
            subject: "Password reset", status: "failed",
            error_message: emailStatus.error,
            related_entity: "user_profile", related_id: user_id,
          });
        }
      }
      return json({ success: true, email: emailStatus });
    }

    if (action === "delete") {
      const { user_id } = body;
      if (!user_id) return json({ error: "Missing user_id" }, 400);
      if (user_id === ures.user.id) return json({ error: "You cannot delete yourself" }, 400);
      const { data: target } = await admin.from("user_profiles").select("email").eq("id", user_id).maybeSingle();
      const { error } = await admin.auth.admin.deleteUser(user_id);
      if (error) return json({ error: error.message }, 400);
      await admin.from("user_profiles").delete().eq("id", user_id);
      await admin.from("activity_logs").insert({
        user_id: ures.user.id, action_type: "delete_user", entity_type: "user_profile",
        entity_id: user_id, description: `Deleted user ${target?.email || user_id}`,
      });
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e: any) {
    return json({ error: e.message || String(e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });
}
// Creates a user (auth + profile). Super Admin only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { email, password, full_name, role } = await req.json();
    if (!email || !password || !full_name) return json({ error: "Missing fields" }, 400);

    const { data: created, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name, role: role || "manager" },
    });
    if (error) return json({ error: error.message }, 400);

    // ensure profile reflects role
    await admin.from("user_profiles").upsert({
      id: created.user!.id, email, full_name, role: role || "manager", is_active: true,
    });

    await admin.from("activity_logs").insert({
      user_id: ures.user.id, action_type: "create_user", entity_type: "user_profile",
      entity_id: created.user!.id, description: `Created ${role} ${email}`,
    });

    return json({ success: true, user_id: created.user!.id });
  } catch (e: any) {
    return json({ error: e.message || String(e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });
}
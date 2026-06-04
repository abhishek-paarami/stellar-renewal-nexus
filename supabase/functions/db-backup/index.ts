// Super Admin database backup & restore.
//  - action="export" -> returns { version, exported_at, tables: { <table>: rows[] } }
//  - action="import" -> body: { data: <export-payload>, mode: "replace"|"merge" }
// Replace mode wipes each table (in FK-safe order) and re-inserts every row.
// Merge mode upserts by primary key without deleting anything.
// bytea (encrypted) columns round-trip as PostgREST "\\x..." hex strings.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Forward order is used for INSERT (parents first). Reverse for DELETE.
const TABLES = [
  "app_settings",
  "custom_roles",
  "user_profiles",
  "clients",
  "bd_persons",
  "developers",
  "custom_role_members",
  "email_templates",
  "renewals",
  "amc_clients",
  "time_entries",
  "credential_access_logs",
  "email_logs",
  "reminder_logs",
  "activity_logs",
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function fetchAllRows(admin: any, table: string): Promise<any[]> {
  const out: any[] = [];
  const pageSize = 1000;
  let from = 0;
  // Paginate to avoid 1k row Supabase default cap.
  while (true) {
    const { data, error } = await admin
      .from(table)
      .select("*")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data || []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const admin = createClient(
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
    const { data: prof } = await admin
      .from("user_profiles")
      .select("role")
      .eq("id", ures.user.id)
      .maybeSingle();
    if (!prof || prof.role !== "super_admin") {
      return json({ error: "Super Admin only" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || "export";

    if (action === "export") {
      const out: Record<string, any[]> = {};
      for (const t of TABLES) {
        try {
          out[t] = await fetchAllRows(admin, t);
        } catch (e: any) {
          // Table may not exist yet — record empty and continue.
          out[t] = [];
          console.error("export skip", t, e?.message);
        }
      }
      await admin.from("activity_logs").insert({
        user_id: ures.user.id,
        action_type: "db_export",
        entity_type: "system",
        description: `Exported full database backup (${TABLES.length} tables)`,
      });
      return json({
        version: 1,
        exported_at: new Date().toISOString(),
        exported_by: ures.user.email,
        tables: out,
      });
    }

    if (action === "import") {
      const payload = body.data;
      const mode: "replace" | "merge" = body.mode === "merge" ? "merge" : "replace";
      if (!payload || !payload.tables) return json({ error: "Invalid backup payload" }, 400);
      const tables = payload.tables as Record<string, any[]>;
      const report: Record<string, { inserted: number; deleted?: number; error?: string }> = {};

      // REPLACE: delete in reverse dependency order first.
      if (mode === "replace") {
        for (const t of [...TABLES].reverse()) {
          if (t === "user_profiles") continue; // never wipe profiles (FK to auth.users)
          if (t === "app_settings") continue;  // crypto_key must survive
          try {
            const { error, count } = await admin.from(t).delete({ count: "exact" }).not("id", "is", null);
            if (error) throw error;
            report[t] = { inserted: 0, deleted: count || 0 };
          } catch (e: any) {
            report[t] = { inserted: 0, error: `delete: ${e?.message || e}` };
          }
        }
      }

      // Insert / upsert in forward dependency order.
      for (const t of TABLES) {
        const rows = tables[t];
        if (!Array.isArray(rows) || rows.length === 0) {
          report[t] = { ...(report[t] || { inserted: 0 }), inserted: 0 };
          continue;
        }
        try {
          // Chunk to avoid request size limits.
          const chunkSize = 500;
          let inserted = 0;
          for (let i = 0; i < rows.length; i += chunkSize) {
            const chunk = rows.slice(i, i + chunkSize);
            const q = mode === "merge"
              ? admin.from(t).upsert(chunk, { onConflict: "id" })
              : admin.from(t).insert(chunk);
            const { error } = await q;
            if (error) throw error;
            inserted += chunk.length;
          }
          report[t] = { ...(report[t] || {}), inserted };
        } catch (e: any) {
          report[t] = { ...(report[t] || { inserted: 0 }), error: e?.message || String(e) };
        }
      }

      await admin.from("activity_logs").insert({
        user_id: ures.user.id,
        action_type: "db_import",
        entity_type: "system",
        description: `Restored database backup (mode=${mode})`,
      });
      return json({ success: true, mode, report });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
});
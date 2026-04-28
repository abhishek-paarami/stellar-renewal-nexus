import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KeyRound, Shield, Activity } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_app/credentials")({ component: CredentialsAuditPage });

interface LogRow {
  id: string;
  renewal_id: string;
  accessed_by: string;
  accessed_at: string;
}

function CredentialsAuditPage() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [renewals, setRenewals] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: l }, { data: r }, { data: u }] = await Promise.all([
      supabase.from("credential_access_logs").select("*").order("accessed_at", { ascending: false }).limit(200),
      supabase.from("renewals").select("id, domain"),
      supabase.from("user_profiles").select("id, full_name, email"),
    ]);
    setLogs((l as any) || []);
    const rmap: Record<string, string> = {};
    (r || []).forEach((x: any) => { rmap[x.id] = x.domain; });
    setRenewals(rmap);
    const umap: Record<string, string> = {};
    (u || []).forEach((x: any) => { umap[x.id] = x.full_name || x.email; });
    setUsers(umap);
    setLoading(false);
  }

  return (
    <div>
      <PageHeader
        title="Credentials Vault"
        description="Encrypted credentials are accessed from each Renewal row. Every access is recorded below."
        actions={<Badge variant="outline" className="gap-1.5"><Shield className="h-3 w-3" /> AES via pgcrypto · Super Admin gated</Badge>}
      />

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-5 py-3 text-sm font-medium">
          <Activity className="h-4 w-4 text-primary" />
          Access Audit Log
          <Badge variant="outline" className="ml-auto">{logs.length} events</Badge>
        </div>
        {loading ? <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
          : logs.length === 0 ? <EmptyState icon={KeyRound} title="No credential accesses yet" description="Access events appear here when Super Admins reveal stored credentials." />
          : (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/20">
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Renewal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-accent/30">
                    <td className="px-4 py-3 font-mono text-xs">{fmtDate(l.accessed_at)} · {new Date(l.accessed_at).toLocaleTimeString()}</td>
                    <td className="px-4 py-3 font-medium">{users[l.accessed_by] || l.accessed_by.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{renewals[l.renewal_id] || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </Card>
    </div>
  );
}
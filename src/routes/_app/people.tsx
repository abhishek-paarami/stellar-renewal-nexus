import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, Power } from "lucide-react";
import { logActivity } from "@/lib/activity-log";
import { WarningConfirmDialog } from "@/components/warning-confirm-dialog";

export const Route = createFileRoute("/_app/people")({
  component: PeoplePage,
});

type Row = { id: string; name: string; email: string | null; is_active: boolean };

// Every tab comes from a custom role. If the role label matches a built-in
// people table (Developers / BD Persons), we read & write that table directly
// so historical entries stay visible. Otherwise members live in custom_role_members.
type Tab = {
  roleId: string;
  title: string;
  table: "developers" | "bd_persons" | "custom_role_members";
};

function resolveTable(label: string): "developers" | "bd_persons" | "custom_role_members" {
  const n = label.trim().toLowerCase();
  if (n === "developer" || n === "developers") return "developers";
  if (n === "bd" || n === "bd person" || n === "bd persons" || n === "business development") return "bd_persons";
  return "custom_role_members";
}

function ListEditor({ tab }: { tab: Tab }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [delTarget, setDelTarget] = useState<Row | null>(null);
  const title = tab.title;

  const load = async () => {
    const q = tab.table === "custom_role_members"
      ? supabase.from("custom_role_members" as any).select("*").eq("role_id", tab.roleId).order("name")
      : supabase.from(tab.table).select("*").order("name");
    const { data, error } = await q;
    if (error) return toast.error(error.message);
    setRows((data || []) as Row[]);
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [tab.roleId, tab.table]);

  const add = async () => {
    if (!name.trim()) return;
    const payload: any = { name: name.trim(), email: email.trim() || null };
    if (tab.table === "custom_role_members") payload.role_id = tab.roleId;
    const tbl: any = tab.table;
    const { error } = await supabase.from(tbl).insert(payload);
    if (error) return toast.error(error.message);
    void logActivity({ action: "create", entity: "user", description: `Added ${title}: ${name}` });
    setName(""); setEmail(""); void load();
  };
  const toggle = async (r: Row) => {
    const tbl: any = tab.table;
    const { error } = await supabase.from(tbl).update({ is_active: !r.is_active }).eq("id", r.id);
    if (error) return toast.error(error.message);
    void logActivity({ action: "update", entity: "user", description: `${r.is_active ? "Disabled" : "Enabled"} ${r.name}` });
    void load();
  };
  const remove = (r: Row) => setDelTarget(r);
  const confirmDelete = async (r: Row) => {
    const tbl: any = tab.table;
    const { error } = await supabase.from(tbl).delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    void logActivity({ action: "delete", entity: "user", description: `Deleted ${r.name}` });
    void load();
  };

  return (
    <>
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" /></div>
          <div><Label>Email (optional)</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@paaramidigital.com" /></div>
          <div className="flex items-end"><Button onClick={add} className="w-full md:w-auto">Add</Button></div>
        </div>
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Status</th><th className="p-3 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No entries yet.</td></tr>}
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3 font-medium">{r.name}</td>
                  <td className="p-3 text-muted-foreground">{r.email || "—"}</td>
                  <td className="p-3">{r.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Disabled</Badge>}</td>
                  <td className="p-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => toggle(r)}><Power className="mr-1 h-3.5 w-3.5" />{r.is_active ? "Disable" : "Enable"}</Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => remove(r)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
    {/* Type-DELETE confirmation */}
    <WarningConfirmDialog
      open={!!delTarget}
      onOpenChange={(o) => !o && setDelTarget(null)}
      title={`Delete ${title.replace(/s$/, "")}?`}
      description={delTarget ? (
        <>This will remove <b>{delTarget.name}</b> from {title}. This action cannot be undone.</>
      ) : ""}
      confirmLabel="Delete"
      requireText="DELETE"
      onConfirm={async () => { if (delTarget) { await confirmDelete(delTarget); setDelTarget(null); } }}
    />
    </>
  );
}

function PeoplePage() {
  const { isSuperAdmin } = useAuth();
  const [customRoles, setCustomRoles] = useState<{ id: string; label: string }[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("custom_roles" as any).select("id,label").order("label");
      setCustomRoles((data as any) || []);
      setLoaded(true);
    })();
  }, []);

  if (!isSuperAdmin) {
    return <div className="rounded-md border bg-card p-8 text-center text-muted-foreground">Super Admin access required.</div>;
  }

  const tabs: Tab[] = customRoles.map((r) => ({
    roleId: r.id,
    title: r.label,
    table: resolveTable(r.label),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">People Directory</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage members for every role. Tabs are driven by the Custom Roles list in
          User Management — add or remove a role there to control what appears here.
        </p>
      </div>
      {tabs.length === 0 ? (
        <div className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">
          {loaded ? "No roles defined yet. Create a role in User Management to start adding people." : "Loading roles..."}
        </div>
      ) : (
        <Tabs defaultValue={tabs[0].roleId}>
          <TabsList className="flex-wrap">
            {tabs.map((t) => (
              <TabsTrigger key={t.roleId} value={t.roleId}>{t.title}</TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((t) => (
            <TabsContent key={t.roleId} value={t.roleId} className="mt-4">
              <ListEditor tab={t} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
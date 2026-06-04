import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { useAuth } from "@/lib/auth-context";
import { fmtDate } from "@/lib/format";
import { logActivity } from "@/lib/activity-log";
import { WarningConfirmDialog } from "@/components/warning-confirm-dialog";

export const Route = createFileRoute("/_app/clients")({ component: ClientsPage });

interface ClientRow {
  id: string; company_name: string; primary_contact: string | null;
  primary_email: string | null; primary_phone: string | null;
  client_type: "internal" | "external"; notes: string | null;
  address: string | null; created_at: string;
}

function ClientsPage() {
  const { isSuperAdmin } = useAuth();
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClientRow | null>(null);
  const [delTarget, setDelTarget] = useState<ClientRow | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data as any) || []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const filtered = rows.filter((r) => `${r.company_name} ${r.primary_email} ${r.primary_contact}`.toLowerCase().includes(search.toLowerCase()));

  const del = (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (row) setDelTarget(row);
  };
  const confirmDelete = async (row: ClientRow) => {
    const { error } = await supabase.from("clients").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    void logActivity({ action: "delete", entity: "client", entityId: row.id,
      description: `Deleted client "${row.company_name}"` });
    toast.success("Deleted"); void load();
  };

  return (
    <div>
      <PageHeader title="Clients" description="Master directory of every internal & external client."
        actions={<Button onClick={() => { setEditing(null); setOpen(true); }} className="bg-gradient-to-r from-primary to-primary-glow"><Plus className="mr-2 h-4 w-4" /> New Client</Button>} />
      <div className="mb-4 flex items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="pl-10" />
        </div>
        <Badge variant="outline">{filtered.length} clients</Badge>
      </div>
      {loading ? <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
        : filtered.length === 0 ? <EmptyState icon={Users} title="No clients yet" description="Add your first client." action={<Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Client</Button>} />
        : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30"><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Company</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Email</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Created</th><th className="px-4 py-3 text-right">Actions</th>
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((r) => (
                    <tr key={r.id} className="hover:bg-accent/30">
                      <td className="px-4 py-3 font-medium">{r.company_name}</td>
                      <td className="px-4 py-3"><Badge variant="outline">{r.client_type}</Badge></td>
                      <td className="px-4 py-3 text-muted-foreground">{r.primary_contact || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.primary_email || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.primary_phone || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(r.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                          {isSuperAdmin && <Button size="icon" variant="ghost" onClick={() => del(r.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      <ClientDialog open={open} onOpenChange={setOpen} client={editing} onSaved={() => { setOpen(false); void load(); }} />
      <WarningConfirmDialog
        open={!!delTarget}
        onOpenChange={(o) => !o && setDelTarget(null)}
        title="Delete this client?"
        description={delTarget ? (
          <>This will permanently delete <b>{delTarget.company_name}</b>. Linked renewals/AMC entries may also be affected. This action cannot be undone.</>
        ) : ""}
        confirmLabel="Delete client"
        requireText="DELETE"
        onConfirm={async () => { if (delTarget) { await confirmDelete(delTarget); setDelTarget(null); } }}
      />
    </div>
  );
}

function ClientDialog({ open, onOpenChange, client, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; client: ClientRow | null; onSaved: () => void }) {
  const [form, setForm] = useState({ company_name: "", primary_contact: "", primary_email: "", primary_phone: "", client_type: "external" as "internal" | "external", address: "", notes: "" });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setForm(client ? {
      company_name: client.company_name, primary_contact: client.primary_contact || "", primary_email: client.primary_email || "",
      primary_phone: client.primary_phone || "", client_type: client.client_type, address: client.address || "", notes: client.notes || "",
    } : { company_name: "", primary_contact: "", primary_email: "", primary_phone: "", client_type: "external", address: "", notes: "" });
  }, [client, open]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company_name.trim()) return toast.error("Company name required");
    setSaving(true);
    const res = client ? await supabase.from("clients").update(form).eq("id", client.id) : await supabase.from("clients").insert(form);
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    void logActivity({
      action: client ? "update" : "create", entity: "client", entityId: client?.id,
      description: `${client ? "Updated" : "Created"} client "${form.company_name}"`,
    });
    toast.success(client ? "Updated" : "Created"); onSaved();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{client ? "Edit Client" : "New Client"}</DialogTitle><DialogDescription>Manage client information.</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-2"><Label>Company Name *</Label><Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} required /></div>
          <div className="space-y-2"><Label>Type</Label>
            <Select value={form.client_type} onValueChange={(v) => setForm({ ...form, client_type: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="external">External</SelectItem><SelectItem value="internal">Internal</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Primary Contact</Label><Input value={form.primary_contact} onChange={(e) => setForm({ ...form, primary_contact: e.target.value })} /></div>
          <div className="space-y-2"><Label>Primary Email</Label><Input type="email" value={form.primary_email} onChange={(e) => setForm({ ...form, primary_email: e.target.value })} /></div>
          <div className="space-y-2"><Label>Phone</Label><Input value={form.primary_phone} onChange={(e) => setForm({ ...form, primary_phone: e.target.value })} /></div>
          <div className="col-span-2 space-y-2"><Label>Address</Label><Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} /></div>
          <div className="col-span-2 space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : client ? "Update" : "Create"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
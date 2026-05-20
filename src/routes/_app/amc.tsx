import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, Pencil, Trash2, Search, Wrench } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { useAuth } from "@/lib/auth-context";
import { fmtDate, expiryStatus, statusColors } from "@/lib/format";
import { logActivity } from "@/lib/activity-log";

export const Route = createFileRoute("/_app/amc")({
  component: AmcPage,
});

interface AmcRow {
  id: string;
  client_id: string | null;
  website: string | null;
  bd_person: string | null;
  start_date: string;
  end_date: string;
  allocated_hours: number;
  consumed_hours: number;
  is_active: boolean;
  notes: string | null;
  notify_emails: string[] | null;
}

function AmcPage() {
  const { isSuperAdmin } = useAuth();
  const [rows, setRows] = useState<AmcRow[]>([]);
  const [clients, setClients] = useState<{ id: string; company_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AmcRow | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: a }, { data: c }] = await Promise.all([
      supabase.from("amc_clients").select("*").order("end_date", { ascending: true }),
      supabase.from("clients").select("id, company_name").order("company_name"),
    ]);
    setRows((a as any) || []);
    setClients((c as any) || []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.company_name || "—";

  const filtered = rows.filter((r) =>
    `${clientName(r.client_id)} ${r.website} ${r.bd_person}`.toLowerCase().includes(search.toLowerCase())
  );

  const del = async (id: string) => {
    if (!confirm("Delete this AMC?")) return;
    const row = rows.find((r) => r.id === id);
    const { error } = await supabase.from("amc_clients").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void logActivity({
      action: "delete", entity: "amc_client", entityId: id,
      description: `Deleted AMC for ${clientName(row?.client_id || null)}`,
    });
    toast.success("AMC deleted");
    void load();
  };

  return (
    <div>
      <PageHeader
        title="AMC Clients"
        description="Annual Maintenance Contracts with hour tracking & expiry alerts."
        actions={
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="bg-gradient-to-r from-primary to-primary-glow">
            <Plus className="mr-2 h-4 w-4" /> New AMC
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search client, website, BD..." className="pl-10" />
        </div>
        <Badge variant="outline">{filtered.length} AMCs</Badge>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Wrench} title="No AMC clients yet" description="Add an AMC to start tracking hours." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => {
            const used = Number(r.consumed_hours);
            const total = Number(r.allocated_hours);
            const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
            const remaining = Math.max(0, total - used);
            const exp = expiryStatus(r.end_date);
            const hoursLow = remaining / Math.max(total, 1) <= 0.2;
            return (
              <Card key={r.id} className="overflow-hidden">
                <div className="flex items-start justify-between p-5">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold">{clientName(r.client_id)}</h3>
                    {r.website && <p className="truncate text-xs text-muted-foreground">{r.website}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {isSuperAdmin && (
                      <Button size="icon" variant="ghost" onClick={() => del(r.id)} className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-4 px-5 pb-5">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Hours used</span>
                      <span className={`font-medium ${hoursLow ? "text-destructive" : ""}`}>
                        {used.toFixed(1)} / {total.toFixed(1)}h
                      </span>
                    </div>
                    <Progress value={pct} className={pct > 80 ? "[&>div]:bg-destructive" : pct > 60 ? "[&>div]:bg-warning" : ""} />
                    <div className="mt-1 text-[10px] text-muted-foreground">{remaining.toFixed(1)}h remaining</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-muted-foreground">Period</div>
                      <div className="mt-0.5 font-medium">{fmtDate(r.start_date)} → {fmtDate(r.end_date)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Status</div>
                      <Badge variant="outline" className={`${statusColors[exp.variant]} mt-0.5`}>{exp.label}</Badge>
                    </div>
                  </div>
                  {r.bd_person && <div className="text-xs text-muted-foreground">BD: {r.bd_person}</div>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <AmcDialog open={open} onOpenChange={setOpen} amc={editing} clients={clients} onSaved={() => { setOpen(false); void load(); }} />
    </div>
  );
}

function AmcDialog({
  open, onOpenChange, amc, clients, onSaved,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; amc: AmcRow | null;
  clients: { id: string; company_name: string }[]; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    client_id: "", website: "", bd_person: "",
    start_date: "", end_date: "",
    allocated_hours: "", notes: "", is_active: true,
    notify_emails: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (amc) {
      setForm({
        client_id: amc.client_id || "",
        website: amc.website || "",
        bd_person: amc.bd_person || "",
        start_date: amc.start_date,
        end_date: amc.end_date,
        allocated_hours: amc.allocated_hours.toString(),
        notes: amc.notes || "",
        is_active: amc.is_active,
        notify_emails: (amc.notify_emails || []).join(", "),
      });
    } else {
      setForm({ client_id: "", website: "", bd_person: "", start_date: "", end_date: "", allocated_hours: "", notes: "", is_active: true, notify_emails: "" });
    }
  }, [amc, open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_id || !form.start_date || !form.end_date || !form.allocated_hours) {
      return toast.error("Client, dates, and allocated hours are required");
    }
    setSaving(true);
    const payload = {
      client_id: form.client_id,
      website: form.website || null,
      bd_person: form.bd_person || null,
      start_date: form.start_date,
      end_date: form.end_date,
      allocated_hours: parseFloat(form.allocated_hours),
      notes: form.notes || null,
      is_active: form.is_active,
      notify_emails: form.notify_emails
        .split(/[,\s]+/).map((s) => s.trim()).filter((s) => /@/.test(s)),
    };
    const res = amc
      ? await supabase.from("amc_clients").update(payload).eq("id", amc.id)
      : await supabase.from("amc_clients").insert(payload);
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    const newId = amc?.id || (res as any).data?.[0]?.id;
    void logActivity({
      action: amc ? "update" : "create",
      entity: "amc_client", entityId: newId,
      description: `${amc ? "Updated" : "Created"} AMC for ${clients.find((c) => c.id === form.client_id)?.company_name || "client"}`,
    });
    toast.success(amc ? "AMC updated" : "AMC created");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{amc ? "Edit AMC" : "New AMC"}</DialogTitle>
          <DialogDescription>Annual contract with allocated support hours.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-2">
            <Label>Client *</Label>
            <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Website</Label>
            <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>BD Person</Label>
            <Input value={form.bd_person} onChange={(e) => setForm({ ...form, bd_person: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Start Date *</Label>
            <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label>End Date *</Label>
            <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} required />
          </div>
          <div className="col-span-2 space-y-2">
            <Label>Allocated Hours *</Label>
            <Input type="number" step="0.5" value={form.allocated_hours} onChange={(e) => setForm({ ...form, allocated_hours: e.target.value })} required />
          </div>
          <div className="col-span-2 space-y-2">
            <Label>Notification Emails</Label>
            <Input
              value={form.notify_emails}
              onChange={(e) => setForm({ ...form, notify_emails: e.target.value })}
              placeholder="ops@client.com, manager@client.com"
            />
            <p className="text-[11px] text-muted-foreground">
              Comma-separated. We auto-send alerts at 55%, 85%, and 100% hour usage.
            </p>
          </div>
          <div className="col-span-2 space-y-2">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
          </div>
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : amc ? "Update" : "Create"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
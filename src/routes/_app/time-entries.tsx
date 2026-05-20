import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Search, Clock } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { useAuth } from "@/lib/auth-context";
import { fmtDate } from "@/lib/format";
import { logActivity } from "@/lib/activity-log";

export const Route = createFileRoute("/_app/time-entries")({ component: TimeEntriesPage });

type EntryStatus = "pending" | "approved" | "rejected";
interface EntryRow {
  id: string; amc_client_id: string; developer_name: string;
  entry_date: string; work_description: string;
  hours: number; minutes: number; is_billable: boolean;
  status: EntryStatus;
  created_at: string;
}

function TimeEntriesPage() {
  const { isSuperAdmin } = useAuth();
  const [rows, setRows] = useState<EntryRow[]>([]);
  const [amcs, setAmcs] = useState<{ id: string; client_id: string | null; website: string | null }[]>([]);
  const [clients, setClients] = useState<{ id: string; company_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EntryRow | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: e }, { data: a }, { data: c }] = await Promise.all([
      supabase.from("time_entries").select("*").order("entry_date", { ascending: false }),
      supabase.from("amc_clients").select("id, client_id, website"),
      supabase.from("clients").select("id, company_name"),
    ]);
    setRows((e as any) || []);
    setAmcs((a as any) || []);
    setClients((c as any) || []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const amcLabel = (id: string) => {
    const a = amcs.find((x) => x.id === id);
    if (!a) return "—";
    const cn = clients.find((c) => c.id === a.client_id)?.company_name;
    return `${cn || "Unknown"}${a.website ? ` · ${a.website}` : ""}`;
  };

  const filtered = useMemo(() => rows.filter((r) =>
    `${amcLabel(r.amc_client_id)} ${r.developer_name} ${r.work_description}`.toLowerCase().includes(search.toLowerCase())
  ), [rows, search, amcs, clients]);

  const totalHours = filtered.reduce((s, r) => s + Number(r.hours) + Number(r.minutes) / 60, 0);

  const del = async (id: string) => {
    if (!confirm("Delete entry?")) return;
    const { error } = await supabase.from("time_entries").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void logActivity({ action: "delete", entity: "time_entry", entityId: id,
      description: `Deleted time entry` });
    toast.success("Deleted"); void load();
  };

  return (
    <div>
      <PageHeader
        title="Time Entries"
        description="Log developer hours against AMC contracts. Approved entries auto-deduct allocated hours."
        actions={
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="bg-gradient-to-r from-primary to-primary-glow">
            <Plus className="mr-2 h-4 w-4" /> Log Time
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search AMC, developer, work..." className="pl-10" />
        </div>
        <Badge variant="outline">{filtered.length} entries · {totalHours.toFixed(2)}h</Badge>
      </div>

      {loading ? <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
        : filtered.length === 0 ? <EmptyState icon={Clock} title="No time entries" description="Log work against AMCs to track hour consumption." />
        : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">AMC</th>
                    <th className="px-4 py-3">Developer</th>
                    <th className="px-4 py-3">Work</th>
                    <th className="px-4 py-3 text-right">Time</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((r) => (
                    <tr key={r.id} className="hover:bg-accent/30">
                      <td className="px-4 py-3 text-xs">{fmtDate(r.entry_date)}</td>
                      <td className="px-4 py-3 text-xs">{amcLabel(r.amc_client_id)}</td>
                      <td className="px-4 py-3 font-medium">{r.developer_name}</td>
                      <td className="px-4 py-3 max-w-md truncate text-muted-foreground">{r.work_description}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{r.hours}h {r.minutes}m</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={
                          r.status === "approved" ? "bg-success/10 text-success border-success/20"
                          : r.status === "rejected" ? "bg-destructive/10 text-destructive border-destructive/20"
                          : "bg-warning/15 text-warning border-warning/20"
                        }>{r.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => del(r.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

      <EntryDialog
        open={open} onOpenChange={setOpen} entry={editing}
        amcs={amcs} clients={clients}
        onSaved={() => { setOpen(false); void load(); }}
      />
    </div>
  );
}

function EntryDialog({
  open, onOpenChange, entry, amcs, clients, onSaved,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; entry: EntryRow | null;
  amcs: { id: string; client_id: string | null; website: string | null }[];
  clients: { id: string; company_name: string }[];
  onSaved: () => void;
}) {
  const empty = {
    amc_client_id: "", developer_name: "", entry_date: new Date().toISOString().slice(0, 10),
    work_description: "", hours: "0", minutes: "0",
    is_billable: true, status: "approved" as EntryStatus,
  };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (entry) {
      setForm({
        amc_client_id: entry.amc_client_id, developer_name: entry.developer_name,
        entry_date: entry.entry_date, work_description: entry.work_description,
        hours: entry.hours.toString(), minutes: entry.minutes.toString(),
        is_billable: entry.is_billable, status: entry.status,
      });
    } else setForm(empty);
  }, [entry, open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amc_client_id || !form.developer_name || !form.work_description) {
      return toast.error("AMC, developer & work are required");
    }
    setSaving(true);
    const payload = {
      amc_client_id: form.amc_client_id,
      developer_name: form.developer_name,
      entry_date: form.entry_date,
      work_description: form.work_description,
      hours: parseInt(form.hours) || 0,
      minutes: parseInt(form.minutes) || 0,
      is_billable: form.is_billable,
      status: form.status,
    };
    const res = entry
      ? await supabase.from("time_entries").update(payload).eq("id", entry.id)
      : await supabase.from("time_entries").insert(payload);
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    void logActivity({
      action: entry ? "update" : "create",
      entity: "time_entry", entityId: entry?.id,
      description: `${entry ? "Updated" : "Logged"} time entry — ${form.developer_name} · ${form.hours}h ${form.minutes}m`,
    });
    toast.success(entry ? "Updated" : "Logged");
    onSaved();
  };

  const amcLabel = (a: typeof amcs[0]) => {
    const cn = clients.find((c) => c.id === a.client_id)?.company_name;
    return `${cn || "Unknown"}${a.website ? ` · ${a.website}` : ""}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{entry ? "Edit Time Entry" : "Log Time"}</DialogTitle>
          <DialogDescription>Approved entries deduct hours from the AMC.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-2">
            <Label>AMC Client *</Label>
            <Select value={form.amc_client_id} onValueChange={(v) => setForm({ ...form, amc_client_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select AMC" /></SelectTrigger>
              <SelectContent>
                {amcs.map((a) => <SelectItem key={a.id} value={a.id}>{amcLabel(a)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Date *</Label><Input type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} required /></div>
          <div className="space-y-2"><Label>Developer *</Label><Input value={form.developer_name} onChange={(e) => setForm({ ...form, developer_name: e.target.value })} required /></div>
          <div className="space-y-2"><Label>Hours</Label><Input type="number" min="0" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} /></div>
          <div className="space-y-2"><Label>Minutes</Label><Input type="number" min="0" max="59" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} /></div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 flex items-center gap-2 pt-6">
            <input type="checkbox" id="bill" checked={form.is_billable} onChange={(e) => setForm({ ...form, is_billable: e.target.checked })} className="h-4 w-4" />
            <Label htmlFor="bill">Billable</Label>
          </div>
          <div className="col-span-2 space-y-2">
            <Label>Work Description *</Label>
            <Textarea value={form.work_description} onChange={(e) => setForm({ ...form, work_description: e.target.value })} rows={4} required />
          </div>
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : entry ? "Update" : "Log"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
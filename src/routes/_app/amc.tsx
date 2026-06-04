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
import { WarningConfirmDialog } from "@/components/warning-confirm-dialog";

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
  triggers_disabled?: boolean;
}

function AmcPage() {
  const { isSuperAdmin } = useAuth();
  const [rows, setRows] = useState<AmcRow[]>([]);
  const [clients, setClients] = useState<{ id: string; company_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AmcRow | null>(null);
  const [triggerWarn, setTriggerWarn] = useState<AmcRow | null>(null);
  const [delTarget, setDelTarget] = useState<AmcRow | null>(null);

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

  const del = (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (row) setDelTarget(row);
  };

  const confirmDelete = async (row: AmcRow) => {
    const { error } = await supabase.from("amc_clients").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    void logActivity({
      action: "delete", entity: "amc_client", entityId: row.id,
      description: `Deleted AMC for ${clientName(row.client_id)}`,
    });
    toast.success("AMC deleted");
    void load();
  };

  const toggleTriggers = async (r: AmcRow) => {
    const next = !r.triggers_disabled;
    if (next) {
      setTriggerWarn(r);
      return;
    }
    await applyToggleTriggers(r, next);
  };

  const applyToggleTriggers = async (r: AmcRow, next: boolean) => {
    const { error } = await supabase.from("amc_clients" as any).update({ triggers_disabled: next } as any).eq("id", r.id);
    if (error) return toast.error(error.message);
    void logActivity({
      action: "update", entity: "amc_client", entityId: r.id,
      description: `${next ? "Disabled" : "Re-enabled"} email triggers for AMC ${clientName(r.client_id)}`,
    });
    toast.success(next ? "Email triggers disabled" : "Email triggers re-enabled");
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
            const pctRounded = Math.round(pct);
            const pctTone =
              pctRounded >= 100 ? "bg-destructive/15 text-destructive border-destructive/40"
              : pctRounded >= 85 ? "bg-destructive/10 text-destructive border-destructive/20"
              : pctRounded >= 55 ? "bg-warning/15 text-warning border-warning/30"
              : "bg-success/10 text-success border-success/20";
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
                    <div className="flex flex-col items-end gap-1.5">
                      <Badge variant="outline" className={`${statusColors[exp.variant]}`}>{exp.label}</Badge>
                      <Badge variant="outline" className={`${pctTone} font-bold`}>{pctRounded}% used</Badge>
                    </div>
                  </div>
                  {r.bd_person && <div className="text-xs text-muted-foreground">BD: {r.bd_person}</div>}
                  {isSuperAdmin && (
                    <div className="flex items-center justify-between border-t border-border pt-3">
                      <span className="text-[11px] text-muted-foreground">
                        Email triggers: <span className={r.triggers_disabled ? "text-destructive font-medium" : "text-success font-medium"}>
                          {r.triggers_disabled ? "DISABLED" : "Active"}
                        </span>
                      </span>
                      <Button size="sm" variant="outline" onClick={() => toggleTriggers(r)}>
                        {r.triggers_disabled ? "Enable" : "Disable"} triggers
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <AmcDialog
        open={open}
        onOpenChange={setOpen}
        amc={editing}
        clients={clients}
        existingClientIds={new Set(rows.map((r) => r.client_id).filter((x): x is string => !!x))}
        onSaved={() => { setOpen(false); void load(); }}
      />
      <WarningConfirmDialog
        open={!!triggerWarn}
        onOpenChange={(o) => !o && setTriggerWarn(null)}
        title="Disable email triggers?"
        description={triggerWarn ? (
          <>
            No automatic emails (client <b>or</b> internal CC) will be sent for{" "}
            <b>{clientName(triggerWarn.client_id)}</b> until you re-enable. All AMC threshold alerts will be silenced.
          </>
        ) : ""}
        confirmLabel="Disable triggers"
        onConfirm={async () => { if (triggerWarn) { await applyToggleTriggers(triggerWarn, true); setTriggerWarn(null); } }}
      />
      <WarningConfirmDialog
        open={!!delTarget}
        onOpenChange={(o) => !o && setDelTarget(null)}
        title="Delete this AMC?"
        description={delTarget ? (
          <>This will permanently delete the AMC for <b>{clientName(delTarget.client_id)}</b> and all linked time entries. This action cannot be undone.</>
        ) : ""}
        confirmLabel="Delete AMC"
        requireText="DELETE"
        onConfirm={async () => { if (delTarget) { await confirmDelete(delTarget); setDelTarget(null); } }}
      />
    </div>
  );
}

function AmcDialog({
  open, onOpenChange, amc, clients, onSaved, existingClientIds,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; amc: AmcRow | null;
  clients: { id: string; company_name: string }[]; onSaved: () => void;
  existingClientIds: Set<string>;
}) {
  const [form, setForm] = useState({
    client_id: "", website: "", bd_person: "",
    start_date: "", end_date: "",
    allocated_hours: "", notes: "", is_active: true,
    notify_emails: "",
  });
  const [saving, setSaving] = useState(false);
  const [bdList, setBdList] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    void supabase.from("bd_persons").select("id, name").eq("is_active", true).order("name")
      .then(({ data }) => setBdList((data || []) as any));
  }, [open]);

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
                {clients.map((c) => {
                  const taken = existingClientIds.has(c.id) && c.id !== amc?.client_id;
                  return (
                    <SelectItem key={c.id} value={c.id} disabled={taken}>
                      {c.company_name}{taken ? " — already in AMC" : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Website</Label>
            <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>BD Person</Label>
            <Select value={form.bd_person || undefined} onValueChange={(v) => setForm({ ...form, bd_person: v })}>
              <SelectTrigger><SelectValue placeholder={bdList.length ? "Select BD person" : "Add BD persons in People"} /></SelectTrigger>
              <SelectContent>
                {bdList.map((b) => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
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
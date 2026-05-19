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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Search, RefreshCw, KeyRound, Eye, EyeOff, Copy } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { useAuth } from "@/lib/auth-context";
import { fmtDate, expiryStatus, statusColors } from "@/lib/format";

export const Route = createFileRoute("/_app/renewals")({ component: RenewalsPage });

interface RenewalRow {
  id: string;
  client_id: string | null;
  domain: string;
  service_type: string | null;
  ownership: string | null;
  registrar: string | null;
  hosting_provider: string | null;
  domain_expiry: string | null;
  hosting_expiry: string | null;
  ga_expiry: string | null;
  mail_type: string | null;
  email_count: number | null;
  contact_person: string | null;
  contact_emails: string[];
  phone_1: string | null;
  phone_2: string | null;
  client_type: "internal" | "external";
  notes: string | null;
  panel_type: string | null;
  admin_url: string | null;
  ftp_host: string | null;
  ftp_port: number | null;
}

type Filter = "all" | "expired" | "critical" | "warning" | "ok";

function RenewalsPage() {
  const { isSuperAdmin } = useAuth();
  const [rows, setRows] = useState<RenewalRow[]>([]);
  const [clients, setClients] = useState<{ id: string; company_name: string; client_type?: "internal" | "external" }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RenewalRow | null>(null);
  const [vaultId, setVaultId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: r }, { data: c }] = await Promise.all([
      supabase.from("renewals").select("*").order("domain_expiry", { ascending: true, nullsFirst: false }),
      supabase.from("clients").select("id, company_name, client_type").order("company_name"),
    ]);
    setRows((r as any) || []);
    setClients((c as any) || []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.company_name || "—";
  const clientType = (id: string | null) =>
    (clients.find((c) => c.id === id) as any)?.client_type as "internal" | "external" | undefined;

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const blob = `${r.domain} ${clientName(r.client_id)} ${r.contact_person || ""} ${r.registrar || ""}`.toLowerCase();
      if (search && !blob.includes(search.toLowerCase())) return false;
      if (filter === "all") return true;
      const earliest = [r.domain_expiry, r.hosting_expiry, r.ga_expiry].filter(Boolean).sort()[0] || null;
      const v = expiryStatus(earliest).variant;
      return v === filter;
    });
  }, [rows, search, filter, clients]);

  const del = async (id: string) => {
    if (!confirm("Delete this renewal?")) return;
    const { error } = await supabase.from("renewals").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); void load();
  };

  return (
    <div>
      <PageHeader
        title="Renewals"
        description="Domains, hosting, Google Apps & mail expiries."
        actions={
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="bg-gradient-to-r from-primary to-primary-glow">
            <Plus className="mr-2 h-4 w-4" /> New Renewal
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search domain, client, contact..." className="pl-10" />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="expired">Expired</TabsTrigger>
            <TabsTrigger value="critical">≤7d</TabsTrigger>
            <TabsTrigger value="warning">≤30d</TabsTrigger>
            <TabsTrigger value="ok">Healthy</TabsTrigger>
          </TabsList>
        </Tabs>
        <Badge variant="outline">{filtered.length} renewals</Badge>
      </div>

      {loading ? <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
        : filtered.length === 0 ? <EmptyState icon={RefreshCw} title="No renewals" description="Add your first renewal entry." />
        : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">Domain</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Domain Exp</th>
                    <th className="px-4 py-3">Hosting Exp</th>
                    <th className="px-4 py-3">GA Exp</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((r) => {
                    const dExp = expiryStatus(r.domain_expiry);
                    const hExp = expiryStatus(r.hosting_expiry);
                    const gExp = expiryStatus(r.ga_expiry);
                    return (
                      <tr key={r.id} className="hover:bg-accent/30">
                        <td className="px-4 py-3">
                          <div className="font-medium">{r.domain}</div>
                          <div className="text-xs text-muted-foreground">{r.registrar || "—"}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm">{clientName(r.client_id)}</div>
                          <Badge variant="outline" className="mt-1 text-[10px]">{r.client_type}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs">{fmtDate(r.domain_expiry)}</div>
                          <Badge variant="outline" className={`${statusColors[dExp.variant]} mt-1 text-[10px]`}>{dExp.label}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs">{fmtDate(r.hosting_expiry)}</div>
                          <Badge variant="outline" className={`${statusColors[hExp.variant]} mt-1 text-[10px]`}>{hExp.label}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs">{fmtDate(r.ga_expiry)}</div>
                          <Badge variant="outline" className={`${statusColors[gExp.variant]} mt-1 text-[10px]`}>{gExp.label}</Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          <div>{r.contact_person || "—"}</div>
                          <div>{r.phone_1 || ""}</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            {isSuperAdmin && (
                              <Button size="icon" variant="ghost" onClick={() => setVaultId(r.id)} title="View credentials">
                                <KeyRound className="h-4 w-4" />
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {isSuperAdmin && (
                              <Button size="icon" variant="ghost" onClick={() => del(r.id)} className="text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

      <RenewalDialog
        open={open}
        onOpenChange={setOpen}
        renewal={editing}
        clients={clients}
        onSaved={() => { setOpen(false); void load(); }}
      />
      {vaultId && <CredentialsDialog renewalId={vaultId} onClose={() => setVaultId(null)} />}
    </div>
  );
}

function RenewalDialog({
  open, onOpenChange, renewal, clients, onSaved,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; renewal: RenewalRow | null;
  clients: { id: string; company_name: string; client_type?: "internal" | "external" }[]; onSaved: () => void;
}) {
  const empty = {
    client_id: "", domain: "", service_type: "", ownership: "", registrar: "",
    hosting_provider: "", domain_expiry: "", hosting_expiry: "", ga_expiry: "",
    mail_type: "", email_count: "", contact_person: "", contact_emails: "",
    phone_1: "", phone_2: "", client_type: "external" as "internal" | "external",
    notes: "", panel_type: "", admin_url: "", username: "", password: "",
    ftp_host: "", ftp_username: "", ftp_password: "", ftp_port: "",
  };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (renewal) {
      setForm({
        ...empty,
        client_id: renewal.client_id ?? "",
        domain: renewal.domain,
        service_type: renewal.service_type ?? "",
        ownership: renewal.ownership ?? "",
        registrar: renewal.registrar ?? "",
        hosting_provider: renewal.hosting_provider ?? "",
        domain_expiry: renewal.domain_expiry ?? "",
        hosting_expiry: renewal.hosting_expiry ?? "",
        ga_expiry: renewal.ga_expiry ?? "",
        mail_type: renewal.mail_type ?? "",
        email_count: renewal.email_count?.toString() ?? "",
        contact_person: renewal.contact_person ?? "",
        contact_emails: (renewal.contact_emails ?? []).join(", "),
        phone_1: renewal.phone_1 ?? "",
        phone_2: renewal.phone_2 ?? "",
        client_type: renewal.client_type,
        notes: renewal.notes ?? "",
        panel_type: renewal.panel_type ?? "",
        admin_url: renewal.admin_url ?? "",
        ftp_host: renewal.ftp_host ?? "",
        ftp_port: renewal.ftp_port?.toString() ?? "",
      });
    } else setForm(empty);
  }, [renewal, open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.domain.trim()) return toast.error("Domain is required");
    setSaving(true);
    const payload: any = {
      client_id: form.client_id || null,
      domain: form.domain.trim(),
      service_type: form.service_type || null,
      ownership: form.ownership || null,
      registrar: form.registrar || null,
      hosting_provider: form.hosting_provider || null,
      domain_expiry: form.domain_expiry || null,
      hosting_expiry: form.hosting_expiry || null,
      ga_expiry: form.ga_expiry || null,
      mail_type: form.mail_type || null,
      email_count: form.email_count ? parseInt(form.email_count) : null,
      contact_person: form.contact_person || null,
      contact_emails: form.contact_emails
        ? form.contact_emails.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      phone_1: form.phone_1 || null,
      phone_2: form.phone_2 || null,
      client_type: form.client_type,
      notes: form.notes || null,
      panel_type: form.panel_type || null,
      admin_url: form.admin_url || null,
      ftp_host: form.ftp_host || null,
      ftp_port: form.ftp_port ? parseInt(form.ftp_port) : null,
    };

    let renewalId = renewal?.id;
    if (renewal) {
      const { error } = await supabase.from("renewals").update(payload).eq("id", renewal.id);
      if (error) { setSaving(false); return toast.error(error.message); }
    } else {
      const { data, error } = await supabase.from("renewals").insert(payload).select("id").single();
      if (error) { setSaving(false); return toast.error(error.message); }
      renewalId = data.id;
    }

    // If creds entered, save via secure RPC
    if (renewalId && (form.username || form.password || form.ftp_username || form.ftp_password)) {
      const { error: rpcErr } = await supabase.rpc("set_renewal_credentials", {
        _renewal_id: renewalId,
        _admin_url: form.admin_url,
        _username: form.username,
        _password: form.password,
        _panel_type: form.panel_type,
        _ftp_host: form.ftp_host,
        _ftp_username: form.ftp_username,
        _ftp_password: form.ftp_password,
        _ftp_port: form.ftp_port ? parseInt(form.ftp_port) : (0 as number),
      } as any);
      if (rpcErr) { setSaving(false); return toast.error(`Saved but credentials failed: ${rpcErr.message}`); }
    }

    setSaving(false);
    toast.success(renewal ? "Updated" : "Created");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{renewal ? "Edit Renewal" : "New Renewal"}</DialogTitle>
          <DialogDescription>Manage domain, hosting, GA expiry & credentials.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-2">
            <Label>Domain *</Label>
            <Input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} required placeholder="example.com" />
          </div>
          <div className="space-y-2">
            <Label>Client</Label>
            <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={form.client_type} onValueChange={(v) => setForm({ ...form, client_type: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="external">External</SelectItem>
                <SelectItem value="internal">Internal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Service Type</Label><Input value={form.service_type} onChange={(e) => setForm({ ...form, service_type: e.target.value })} placeholder="Domain + Hosting" /></div>
          <div className="space-y-2"><Label>Ownership</Label><Input value={form.ownership} onChange={(e) => setForm({ ...form, ownership: e.target.value })} placeholder="Client / Paarami" /></div>
          <div className="space-y-2"><Label>Registrar</Label><Input value={form.registrar} onChange={(e) => setForm({ ...form, registrar: e.target.value })} /></div>
          <div className="space-y-2"><Label>Hosting Provider</Label><Input value={form.hosting_provider} onChange={(e) => setForm({ ...form, hosting_provider: e.target.value })} /></div>
          <div className="space-y-2"><Label>Domain Expiry</Label><Input type="date" value={form.domain_expiry} onChange={(e) => setForm({ ...form, domain_expiry: e.target.value })} /></div>
          <div className="space-y-2"><Label>Hosting Expiry</Label><Input type="date" value={form.hosting_expiry} onChange={(e) => setForm({ ...form, hosting_expiry: e.target.value })} /></div>
          <div className="space-y-2"><Label>GA Expiry</Label><Input type="date" value={form.ga_expiry} onChange={(e) => setForm({ ...form, ga_expiry: e.target.value })} /></div>
          <div className="space-y-2"><Label>Mail Type</Label><Input value={form.mail_type} onChange={(e) => setForm({ ...form, mail_type: e.target.value })} placeholder="Google Workspace / Zoho / cPanel" /></div>
          <div className="space-y-2"><Label>Email Count</Label><Input type="number" value={form.email_count} onChange={(e) => setForm({ ...form, email_count: e.target.value })} /></div>
          <div className="space-y-2"><Label>Contact Person</Label><Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></div>
          <div className="space-y-2"><Label>Phone 1</Label><Input value={form.phone_1} onChange={(e) => setForm({ ...form, phone_1: e.target.value })} /></div>
          <div className="space-y-2"><Label>Phone 2</Label><Input value={form.phone_2} onChange={(e) => setForm({ ...form, phone_2: e.target.value })} /></div>
          <div className="col-span-2 space-y-2">
            <Label>Reminder Emails (comma separated)</Label>
            <Input value={form.contact_emails} onChange={(e) => setForm({ ...form, contact_emails: e.target.value })} placeholder="ops@example.com, billing@example.com" />
          </div>

          <div className="col-span-2 mt-2 border-t border-border pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Hosting Credentials (encrypted at rest)
          </div>
          <div className="space-y-2"><Label>Panel Type</Label><Input value={form.panel_type} onChange={(e) => setForm({ ...form, panel_type: e.target.value })} placeholder="cPanel / Plesk / WHM" /></div>
          <div className="space-y-2"><Label>Admin URL</Label><Input value={form.admin_url} onChange={(e) => setForm({ ...form, admin_url: e.target.value })} /></div>
          <div className="space-y-2"><Label>Username</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder={renewal ? "(leave blank to keep)" : ""} /></div>
          <div className="space-y-2"><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={renewal ? "(leave blank to keep)" : ""} /></div>
          <div className="space-y-2"><Label>FTP Host</Label><Input value={form.ftp_host} onChange={(e) => setForm({ ...form, ftp_host: e.target.value })} /></div>
          <div className="space-y-2"><Label>FTP Port</Label><Input type="number" value={form.ftp_port} onChange={(e) => setForm({ ...form, ftp_port: e.target.value })} /></div>
          <div className="space-y-2"><Label>FTP Username</Label><Input value={form.ftp_username} onChange={(e) => setForm({ ...form, ftp_username: e.target.value })} /></div>
          <div className="space-y-2"><Label>FTP Password</Label><Input type="password" value={form.ftp_password} onChange={(e) => setForm({ ...form, ftp_password: e.target.value })} /></div>

          <div className="col-span-2 space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : renewal ? "Update" : "Create"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CredentialsDialog({ renewalId, onClose }: { renewalId: string; onClose: () => void }) {
  const [creds, setCreds] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase.rpc("get_renewal_credentials", { _renewal_id: renewalId });
      if (error) { toast.error(error.message); onClose(); return; }
      setCreds(Array.isArray(data) ? data[0] : data);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renewalId]);

  const copy = (label: string, val: string | null) => {
    if (!val) return;
    navigator.clipboard.writeText(val);
    toast.success(`${label} copied`);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Credentials</DialogTitle>
          <DialogDescription>This access is logged & audited. Super Admin only.</DialogDescription>
        </DialogHeader>
        {loading || !creds ? <div className="py-6 text-center text-sm text-muted-foreground">Decrypting...</div> : (
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShow(!show)}>
                {show ? <EyeOff className="mr-1 h-3 w-3" /> : <Eye className="mr-1 h-3 w-3" />}
                {show ? "Hide" : "Reveal"}
              </Button>
            </div>
            {[
              ["Panel", creds.panel_type],
              ["Admin URL", creds.admin_url],
              ["Username", creds.username],
              ["Password", creds.password],
              ["FTP Host", creds.ftp_host],
              ["FTP Port", creds.ftp_port],
              ["FTP Username", creds.ftp_username],
              ["FTP Password", creds.ftp_password],
            ].map(([label, val]) => (
              <div key={label as string} className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label as string}</div>
                  <div className="truncate font-mono">
                    {val ? (show || !["Password", "FTP Password"].includes(label as string) ? String(val) : "••••••••") : "—"}
                  </div>
                </div>
                {val && (
                  <Button size="icon" variant="ghost" onClick={() => copy(label as string, String(val))}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
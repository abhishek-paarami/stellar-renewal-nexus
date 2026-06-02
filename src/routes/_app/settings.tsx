import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Save, Mail, Bell, Send, Activity, Inbox } from "lucide-react";
import { toast } from "sonner";
import { fmtDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { Download } from "lucide-react";

type Preset = "today" | "7d" | "30d" | "90d" | "all";
function rangeFor(p: Preset): { from: string | null; to: string | null } {
  const now = new Date();
  const iso = (d: Date) => d.toISOString();
  if (p === "all") return { from: null, to: null };
  if (p === "today") {
    const start = new Date(now); start.setHours(0,0,0,0);
    return { from: iso(start), to: iso(now) };
  }
  const days = p === "7d" ? 7 : p === "30d" ? 30 : 90;
  const start = new Date(now.getTime() - days * 86400000);
  return { from: iso(start), to: iso(now) };
}

function LogFilterBar({
  preset, setPreset, from, to, setFrom, setTo, onExport,
}: {
  preset: Preset; setPreset: (p: Preset) => void;
  from: string; to: string; setFrom: (v: string) => void; setTo: (v: string) => void;
  onExport: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
      <div className="flex rounded-md border border-border bg-muted/30 p-0.5 text-xs">
        {(["today","7d","30d","90d","all"] as Preset[]).map((p) => (
          <button key={p} onClick={() => setPreset(p)}
            className={`px-3 py-1 rounded ${preset === p ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}>
            {p === "all" ? "All" : p === "today" ? "Today" : `Last ${p}`}
          </button>
        ))}
      </div>
      <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPreset("all"); }} className="h-8 w-40" />
      <span className="text-xs text-muted-foreground">to</span>
      <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPreset("all"); }} className="h-8 w-40" />
      <Button variant="outline" size="sm" className="ml-auto" onClick={onExport}>
        <Download className="mr-2 h-3 w-3" /> Export CSV
      </Button>
    </div>
  );
}

function downloadCsv(filename: string, rows: any[], cols: { key: string; label: string }[]) {
  if (!rows.length) { toast.error("No data to export"); return; }
  const head = cols.map((c) => `"${c.label}"`).join(",");
  const body = rows.map((r) => cols.map((c) => {
    const v = r[c.key];
    const s = v === null || v === undefined ? "" : Array.isArray(v) ? v.join("; ") : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  }).join(",")).join("\n");
  const blob = new Blob([head + "\n" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function useLogFilter(defaultPreset: Preset = "30d") {
  const [preset, setPreset] = useState<Preset>(defaultPreset);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const range = preset === "all" && (from || to)
    ? {
        from: from ? new Date(from + "T00:00:00").toISOString() : null,
        to:   to   ? new Date(to   + "T23:59:59").toISOString() : null,
      }
    : rangeFor(preset);
  return { preset, setPreset, from, to, setFrom, setTo, range };
}

export const Route = createFileRoute("/_app/settings")({ component: SettingsPage });

// Default professional template body used when auto-seeding new thresholds.
function defaultBody(kind: "renewal" | "amc", value: number) {
  if (kind === "renewal") {
    return {
      key: `renewal_${value}`,
      subject: `Reminder: {{service_name}} expires in ${value} day${value === 1 ? "" : "s"}`,
      html: `<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:auto;background:#fff;padding:32px;border:1px solid #eee;border-radius:12px"><h2 style="color:#0f172a;margin:0 0 12px">Renewal due in <span style="color:#b91c1c">{{days_left}} day${value === 1 ? "" : "s"}</span></h2><p style="color:#475569">Hi {{contact_person}},</p><p style="color:#475569">Your <b>{{expiry_kind}}</b> for <b>{{domain}}</b> expires on <b>{{expiry_date}}</b>.</p><p style="color:#b91c1c;font-weight:600">Please initiate renewal to avoid service disruption.</p><p style="color:#94a3b8;font-size:12px;margin-top:24px">— Paarami Digital Operations</p></div>`,
    };
  }
  return {
    key: `amc_hours_${value}`,
    subject: `AMC usage alert: {{client_name}} reached ${value}%`,
    html: `<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:auto;background:#fff;padding:32px;border:1px solid #eee;border-radius:12px"><h2 style="color:#0f172a;margin:0 0 12px">AMC Usage Alert — <span style="color:#b91c1c">${value}% consumed</span></h2><p style="color:#475569">Hi {{contact_person}},</p><p style="color:#475569">Your AMC for <b>{{client_name}}</b> ({{cycle_month}}) has used <b>{{used_hours}}/{{allocated_hours}} hours</b> (<b>{{usage_pct}}%</b>).</p><p style="color:#b91c1c;font-weight:600">Remaining: {{remaining_hours}} hours.</p><p style="color:#94a3b8;font-size:12px;margin-top:24px">— Paarami Digital Operations</p></div>`,
  };
}

async function autoSeedTemplates(days: number[], percents: number[]) {
  const { data: existing } = await supabase.from("email_templates").select("template_key");
  const have = new Set((existing || []).map((t: any) => t.template_key));
  const rows: any[] = [];
  for (const d of days) {
    const t = defaultBody("renewal", d);
    if (!have.has(t.key)) rows.push({ template_key: t.key, subject: t.subject, html_body: t.html });
  }
  for (const p of percents) {
    const t = defaultBody("amc", p);
    if (!have.has(t.key)) rows.push({ template_key: t.key, subject: t.subject, html_body: t.html });
  }
  if (rows.length) await supabase.from("email_templates").insert(rows);
}

function SettingsPage() {
  const { isSuperAdmin } = useAuth();
  if (!isSuperAdmin) return <div className="p-8 text-center text-muted-foreground">Super Admin access required.</div>;

  return (
    <div>
      <PageHeader title="Settings" description="SMTP, reminders, and activity log." />
      <Tabs defaultValue="smtp">
        <TabsList>
          <TabsTrigger value="smtp"><Mail className="mr-2 h-4 w-4" />SMTP</TabsTrigger>
          <TabsTrigger value="reminders"><Bell className="mr-2 h-4 w-4" />Reminders</TabsTrigger>
          <TabsTrigger value="email-log"><Inbox className="mr-2 h-4 w-4" />Email Log</TabsTrigger>
          <TabsTrigger value="logs"><Send className="mr-2 h-4 w-4" />Reminder Log</TabsTrigger>
          <TabsTrigger value="activity"><Activity className="mr-2 h-4 w-4" />Activity Log</TabsTrigger>
        </TabsList>
        <TabsContent value="smtp"><SmtpPanel /></TabsContent>
        <TabsContent value="reminders"><ReminderPanel /></TabsContent>
        <TabsContent value="email-log"><EmailLogs /></TabsContent>
        <TabsContent value="logs"><ReminderLogs /></TabsContent>
        <TabsContent value="activity"><ActivityLogs /></TabsContent>
      </Tabs>
    </div>
  );
}

function SmtpPanel() {
  const [form, setForm] = useState({
    host: "", port: "587", secure: false,
    username: "", password: "",
    from_email: "", from_name: "Paarami Portal",
    enabled: true,
  });
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "smtp").maybeSingle();
      if (data?.value) setForm({ ...form, ...(data.value as any) });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("app_settings").upsert(
      { key: "smtp", value: { ...form, port: parseInt(form.port) || 587 } },
      { onConflict: "key" }
    );
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("SMTP settings saved");
  };

  const sendTest = async () => {
    if (!testEmail) return toast.error("Enter a test email");
    const missing = (["host", "username", "password", "from_email"] as const).filter((k) => !(form as any)[k]);
    if (missing.length) {
      return toast.error(`Please fill in & Save SMTP first. Missing: ${missing.join(", ")}`);
    }
    setTesting(true);
    const { data, error } = await supabase.functions.invoke("send-test-email", {
      body: { to: testEmail },
    });
    setTesting(false);
    if (error) return toast.error(error.message);
    if ((data as any)?.error) return toast.error((data as any).error);
    toast.success(`Test email sent to ${testEmail}`);
  };

  return (
    <Card className="mt-4 p-6">
      <h3 className="mb-1 text-base font-semibold">SMTP Configuration</h3>
      <p className="mb-4 text-xs text-muted-foreground">These credentials are used to send all reminder emails.</p>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Host</Label><Input value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} placeholder="smtp.gmail.com" /></div>
        <div className="space-y-2"><Label>Port</Label><Input type="number" value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} /></div>
        <div className="space-y-2"><Label>Username</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
        <div className="space-y-2"><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
        <div className="space-y-2"><Label>From Email</Label><Input value={form.from_email} onChange={(e) => setForm({ ...form, from_email: e.target.value })} /></div>
        <div className="space-y-2"><Label>From Name</Label><Input value={form.from_name} onChange={(e) => setForm({ ...form, from_name: e.target.value })} /></div>
        <div className="col-span-2 flex items-center gap-3">
          <Switch checked={form.secure} onCheckedChange={(v) => setForm({ ...form, secure: v })} />
          <Label>Use SSL/TLS (port 465)</Label>
        </div>
        <div className="col-span-2 flex items-center gap-3">
          <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
          <Label>Enable email sending</Label>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <Button onClick={save} disabled={saving} className="bg-gradient-to-r from-primary to-primary-glow">
          <Save className="mr-2 h-4 w-4" /> {saving ? "Saving..." : "Save SMTP"}
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="test@example.com" className="w-56" />
          <Button variant="outline" onClick={sendTest} disabled={testing}>
            <Send className="mr-2 h-4 w-4" /> {testing ? "Sending..." : "Send Test"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ReminderPanel() {
  const [form, setForm] = useState({
    days_before: "30,7,1",
    send_after_expiry: true,
    cc_internal: "",
    amc_percents: "55,85,100",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "reminders").maybeSingle();
      if (data?.value) {
        const v: any = data.value;
        setForm({
          days_before: v.days_before ?? "30,7,1",
          send_after_expiry: v.send_after_expiry !== false,
          cc_internal: v.cc_internal ?? "",
          amc_percents: Array.isArray(v.amc_percents)
            ? v.amc_percents.join(",")
            : (v.amc_percents ?? "55,85,100"),
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    // Normalise CSV → arrays of integers so edge functions can read them directly.
    const days = form.days_before.split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n) && n > 0).sort((a,b)=>b-a);
    const percents = form.amc_percents.split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n) && n > 0 && n <= 100).sort((a,b)=>b-a);
    if (!days.length) return toast.error("Days Before Expiry must have at least one number");
    if (!percents.length) return toast.error("AMC % Thresholds must have at least one number 1–100");
    setSaving(true);
    const { error } = await supabase.from("app_settings").upsert(
      { key: "reminders", value: { ...form, renewal_days: days, amc_percents: percents } },
      { onConflict: "key" }
    );
    setSaving(false);
    if (error) return toast.error(error.message);
    // Auto-create missing email templates for any new thresholds
    await autoSeedTemplates(days, percents);
    toast.success("Reminder settings saved — templates synced");
  };

  const triggerNow = async () => {
    const { data, error } = await supabase.functions.invoke("send-renewal-reminders", { body: {} });
    if (error) return toast.error(error.message);
    toast.success(`Reminder run complete: ${(data as any)?.sent ?? 0} sent`);
  };

  return (
    <Card className="mt-4 p-6">
      <h3 className="mb-1 text-base font-semibold">Reminder Schedule</h3>
      <p className="mb-4 text-xs text-muted-foreground">A daily cron sends reminders at 09:00 IST. You can also trigger a run manually.</p>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Days Before Expiry (CSV)</Label><Input value={form.days_before} onChange={(e) => setForm({ ...form, days_before: e.target.value })} placeholder="30,7,1" /></div>
        <div className="space-y-2">
          <Label>AMC % Thresholds (CSV)</Label>
          <Input value={form.amc_percents} onChange={(e) => setForm({ ...form, amc_percents: e.target.value })} placeholder="55,85,100" />
          <p className="text-[11px] text-muted-foreground">Alert fires when consumed hours reach each %. Used everywhere: cron, instant alerts, card badges.</p>
        </div>
        <div className="col-span-2 space-y-2"><Label>Always CC (comma separated)</Label><Textarea value={form.cc_internal} onChange={(e) => setForm({ ...form, cc_internal: e.target.value })} rows={2} placeholder="ops@paaramidigital.com" /></div>
        <div className="col-span-2 flex items-center gap-3">
          <Switch checked={form.send_after_expiry} onCheckedChange={(v) => setForm({ ...form, send_after_expiry: v })} />
          <Label>Also send when already expired</Label>
        </div>
      </div>
      <div className="mt-6 flex gap-3 border-t border-border pt-4">
        <Button onClick={save} disabled={saving} className="bg-gradient-to-r from-primary to-primary-glow">
          <Save className="mr-2 h-4 w-4" /> {saving ? "Saving..." : "Save"}
        </Button>
        <Button variant="outline" onClick={triggerNow}><Bell className="mr-2 h-4 w-4" /> Run reminders now</Button>
      </div>
    </Card>
  );
}

function ReminderLogs() {
  const f = useLogFilter("30d");
  const [logs, setLogs] = useState<any[]>([]);
  const load = async () => {
    let q = supabase.from("reminder_logs").select("*").order("sent_at", { ascending: false }).limit(500);
    if (f.range.from) q = q.gte("sent_at", f.range.from);
    if (f.range.to)   q = q.lte("sent_at", f.range.to);
    const { data } = await q;
    setLogs(data || []);
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [f.preset, f.from, f.to]);
  return (
    <Card className="mt-4 overflow-hidden">
      <LogFilterBar {...f} onExport={() => downloadCsv("reminder-logs.csv", logs, [
        { key: "sent_at", label: "When" }, { key: "reminder_type", label: "Type" },
        { key: "expiry_kind", label: "Kind" }, { key: "sent_to", label: "To" },
        { key: "status", label: "Status" }, { key: "error_message", label: "Error" },
      ])} />
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
          <tr><th className="px-4 py-3 text-left">When</th><th className="px-4 py-3 text-left">Type</th><th className="px-4 py-3 text-left">Kind</th><th className="px-4 py-3 text-left">To</th><th className="px-4 py-3 text-left">Status</th></tr>
        </thead>
        <tbody className="divide-y divide-border">
          {logs.map((l) => (
            <tr key={l.id}>
              <td className="px-4 py-3 text-xs">{fmtDate(l.sent_at)} {new Date(l.sent_at).toLocaleTimeString()}</td>
              <td className="px-4 py-3"><Badge variant="outline">{l.reminder_type}</Badge></td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{l.expiry_kind || "—"}</td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{(l.sent_to || []).join(", ")}</td>
              <td className="px-4 py-3">
                <Badge variant="outline" className={l.status === "success" ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"}>
                  {l.status}
                </Badge>
                {l.error_message && <div className="mt-1 text-[10px] text-destructive">{l.error_message}</div>}
              </td>
            </tr>
          ))}
          {logs.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No reminders sent yet.</td></tr>}
        </tbody>
      </table>
    </Card>
  );
}

function EmailLogs() {
  const f = useLogFilter("30d");
  const [logs, setLogs] = useState<any[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const load = async () => {
    let q = supabase.from("email_logs").select("*").order("sent_at", { ascending: false }).limit(500);
    if (f.range.from) q = q.gte("sent_at", f.range.from);
    if (f.range.to)   q = q.lte("sent_at", f.range.to);
    const { data } = await q;
    setLogs(data || []);
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [f.preset, f.from, f.to]);
  return (
    <Card className="mt-4 overflow-hidden">
      <LogFilterBar {...f} onExport={() => downloadCsv("email-logs.csv", logs, [
        { key: "sent_at", label: "When" }, { key: "email_type", label: "Type" },
        { key: "to_addresses", label: "To" }, { key: "subject", label: "Subject" },
        { key: "status", label: "Status" }, { key: "error_message", label: "Error" },
      ])} />
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left">When</th>
            <th className="px-4 py-3 text-left">Type</th>
            <th className="px-4 py-3 text-left">To</th>
            <th className="px-4 py-3 text-left">Subject</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-left">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {logs.map((l) => (
            <Fragment key={l.id}>
              <tr>
                <td className="px-4 py-3 text-xs whitespace-nowrap">{fmtDate(l.sent_at)} {new Date(l.sent_at).toLocaleTimeString()}</td>
                <td className="px-4 py-3"><Badge variant="outline">{l.email_type}</Badge></td>
                <td className="px-4 py-3 text-xs">{(l.to_addresses || []).join(", ")}</td>
                <td className="px-4 py-3 text-xs">{l.subject || "—"}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={l.status === "success" ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"}>
                    {l.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-xs">
                  <button className="text-primary underline" onClick={() => setOpen(open === l.id ? null : l.id)}>
                    {open === l.id ? "Hide" : "View"}
                  </button>
                </td>
              </tr>
              {open === l.id && (
                <tr className="bg-muted/20">
                  <td colSpan={6} className="px-4 py-3">
                    {l.error_message && <div className="mb-2 text-xs text-destructive"><strong>Error:</strong> {l.error_message}</div>}
                    {l.smtp_response && (
                      <pre className="whitespace-pre-wrap break-all rounded bg-background p-3 font-mono text-[11px] text-muted-foreground">{l.smtp_response}</pre>
                    )}
                    {!l.error_message && !l.smtp_response && <div className="text-xs text-muted-foreground">No additional details.</div>}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
          {logs.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No emails sent yet.</td></tr>}
        </tbody>
      </table>
    </Card>
  );
}

function ActivityLogs() {
  const f = useLogFilter("30d");
  const [logs, setLogs] = useState<any[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});
  const load = async () => {
    let q = supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(500);
    if (f.range.from) q = q.gte("created_at", f.range.from);
    if (f.range.to)   q = q.lte("created_at", f.range.to);
    const [{ data: l }, { data: u }] = await Promise.all([
      q,
      supabase.from("user_profiles").select("id, full_name, email"),
    ]);
    setLogs(l || []);
    const m: Record<string, string> = {};
    (u || []).forEach((x: any) => { m[x.id] = x.full_name || x.email; });
    setUsers(m);
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [f.preset, f.from, f.to]);
  return (
    <Card className="mt-4 overflow-hidden">
      <LogFilterBar {...f} onExport={() => downloadCsv("activity-logs.csv", logs, [
        { key: "created_at", label: "When" }, { key: "user_id", label: "User" },
        { key: "action_type", label: "Action" }, { key: "entity_type", label: "Entity" },
        { key: "description", label: "Description" },
      ])} />
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
          <tr><th className="px-4 py-3 text-left">When</th><th className="px-4 py-3 text-left">User</th><th className="px-4 py-3 text-left">Action</th><th className="px-4 py-3 text-left">Entity</th><th className="px-4 py-3 text-left">Description</th></tr>
        </thead>
        <tbody className="divide-y divide-border">
          {logs.map((l) => (
            <tr key={l.id}>
              <td className="px-4 py-3 font-mono text-xs">{fmtDate(l.created_at)} {new Date(l.created_at).toLocaleTimeString()}</td>
              <td className="px-4 py-3 font-medium">{users[l.user_id] || (l.user_id ? l.user_id.slice(0, 8) : "system")}</td>
              <td className="px-4 py-3"><Badge variant="outline">{l.action_type}</Badge></td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{l.entity_type || "—"}</td>
              <td className="px-4 py-3 text-xs">{l.description || "—"}</td>
            </tr>
          ))}
          {logs.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No activity yet.</td></tr>}
        </tbody>
      </table>
    </Card>
  );
}
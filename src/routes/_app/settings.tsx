import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

export const Route = createFileRoute("/_app/settings")({ component: SettingsPage });

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
    amc_low_hours_threshold: "20",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "reminders").maybeSingle();
      if (data?.value) setForm({ ...form, ...(data.value as any) });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("app_settings").upsert(
      { key: "reminders", value: form },
      { onConflict: "key" }
    );
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Reminder settings saved");
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
        <div className="space-y-2"><Label>AMC Low-Hours Threshold (%)</Label><Input type="number" value={form.amc_low_hours_threshold} onChange={(e) => setForm({ ...form, amc_low_hours_threshold: e.target.value })} /></div>
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
  const [logs, setLogs] = useState<any[]>([]);
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("reminder_logs").select("*").order("sent_at", { ascending: false }).limit(100);
      setLogs(data || []);
    })();
  }, []);
  return (
    <Card className="mt-4 overflow-hidden">
      <div className="border-b border-border px-5 py-3 text-sm font-medium">Recent Reminder Sends</div>
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
  const [logs, setLogs] = useState<any[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const load = async () => {
    const { data } = await supabase.from("email_logs").select("*").order("sent_at", { ascending: false }).limit(200);
    setLogs(data || []);
  };
  useEffect(() => { void load(); }, []);
  return (
    <Card className="mt-4 overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="text-sm font-medium">Email Send Log (test + reminders)</div>
        <Button variant="outline" size="sm" onClick={load}>Refresh</Button>
      </div>
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
            <>
              <tr key={l.id}>
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
                <tr key={l.id + "-d"} className="bg-muted/20">
                  <td colSpan={6} className="px-4 py-3">
                    {l.error_message && <div className="mb-2 text-xs text-destructive"><strong>Error:</strong> {l.error_message}</div>}
                    {l.smtp_response && (
                      <pre className="whitespace-pre-wrap break-all rounded bg-background p-3 font-mono text-[11px] text-muted-foreground">{l.smtp_response}</pre>
                    )}
                    {!l.error_message && !l.smtp_response && <div className="text-xs text-muted-foreground">No additional details.</div>}
                  </td>
                </tr>
              )}
            </>
          ))}
          {logs.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No emails sent yet.</td></tr>}
        </tbody>
      </table>
    </Card>
  );
}

function ActivityLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});
  useEffect(() => {
    void (async () => {
      const [{ data: l }, { data: u }] = await Promise.all([
        supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("user_profiles").select("id, full_name, email"),
      ]);
      setLogs(l || []);
      const m: Record<string, string> = {};
      (u || []).forEach((x: any) => { m[x.id] = x.full_name || x.email; });
      setUsers(m);
    })();
  }, []);
  return (
    <Card className="mt-4 overflow-hidden">
      <div className="border-b border-border px-5 py-3 text-sm font-medium">Activity Log</div>
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
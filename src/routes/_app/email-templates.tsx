import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/email-templates")({ component: EmailTemplatesPage });

interface TplRow { id: string; template_key: string; subject: string; html_body: string; updated_at: string; }

const KEY_LABELS: Record<string, string> = {
  renewal_30: "Renewal — 30 days before expiry",
  renewal_7: "Renewal — 7 days before expiry",
  renewal_1: "Renewal — 1 day before expiry",
  renewal_expired: "Renewal — Already expired",
};

const VARIABLES = [
  "{{client_name}}", "{{domain}}", "{{expiry_kind}}",
  "{{expiry_date}}", "{{days_left}}", "{{contact_person}}",
];

function EmailTemplatesPage() {
  const [rows, setRows] = useState<TplRow[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ subject: "", html_body: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const tpl = rows.find((r) => r.id === active);
    if (tpl) setForm({ subject: tpl.subject, html_body: tpl.html_body });
  }, [active, rows]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("email_templates").select("*").order("template_key");
    if (error) toast.error(error.message);
    setRows((data as any) || []);
    if (data && data.length && !active) setActive((data[0] as any).id);
    setLoading(false);
  }

  const save = async () => {
    if (!active) return;
    setSaving(true);
    const { error } = await supabase.from("email_templates").update({ subject: form.subject, html_body: form.html_body }).eq("id", active);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Template saved");
    void load();
  };

  return (
    <div>
      <PageHeader
        title="Email Templates"
        description="Customize the HTML reminders sent automatically at 30, 7, 1 days before expiry, and after expiry."
      />

      {loading ? <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div> : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
          <div className="space-y-2">
            {rows.map((t) => (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
                className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition ${
                  active === t.id ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-accent/40"
                }`}
              >
                <Mail className="mt-0.5 h-4 w-4 text-primary" />
                <div className="min-w-0">
                  <div className="text-sm font-medium">{KEY_LABELS[t.template_key] || t.template_key}</div>
                  <Badge variant="outline" className="mt-1 font-mono text-[10px]">{t.template_key}</Badge>
                </div>
              </button>
            ))}
          </div>

          <Card className="p-6">
            {active ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Subject Line</Label>
                  <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>HTML Body</Label>
                  <Textarea value={form.html_body} onChange={(e) => setForm({ ...form, html_body: e.target.value })} rows={16} className="font-mono text-xs" />
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <div className="mb-2 text-xs font-semibold text-muted-foreground">Available variables</div>
                  <div className="flex flex-wrap gap-1.5">
                    {VARIABLES.map((v) => (
                      <code key={v} className="rounded bg-background px-2 py-1 text-[11px]">{v}</code>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={save} disabled={saving} className="bg-gradient-to-r from-primary to-primary-glow">
                    <Save className="mr-2 h-4 w-4" /> {saving ? "Saving..." : "Save Template"}
                  </Button>
                </div>
              </div>
            ) : <div className="text-center text-muted-foreground">Select a template</div>}
          </Card>
        </div>
      )}
    </div>
  );
}
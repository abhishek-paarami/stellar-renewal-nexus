import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  UploadCloud,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Users,
  RefreshCw,
  Wrench,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  readSheet,
  pick,
  toDate,
  toInt,
  toNum,
  toStr,
  toBool,
  toEmails,
  toClientType,
  detectKind,
  downloadXlsx,
  safeFilename,
  type RowDict,
} from "@/lib/excel-io";

export const Route = createFileRoute("/_app/import-export")({ component: ImportExportPage });

function ImportExportPage() {
  const { isSuperAdmin } = useAuth();
  if (!isSuperAdmin)
    return (
      <div className="p-8 text-center text-muted-foreground">Super Admin access required.</div>
    );

  return (
    <div>
      <PageHeader
        title="Import / Export"
        description="Bulk import all your raw data from Excel — auto-detected & routed to the right tables. Export everything for backup or reporting."
      />
      <Tabs defaultValue="import">
        <TabsList>
          <TabsTrigger value="import">
            <UploadCloud className="mr-2 h-4 w-4" /> Import
          </TabsTrigger>
          <TabsTrigger value="export">
            <Download className="mr-2 h-4 w-4" /> Export
          </TabsTrigger>
        </TabsList>
        <TabsContent value="import">
          <ImportPanel />
        </TabsContent>
        <TabsContent value="export">
          <ExportPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ==================== IMPORT ==================== */

type Preview = {
  fileName: string;
  kind: "clients" | "renewals" | "amc" | "time_entries" | "unknown";
  headers: string[];
  rows: RowDict[];
  sample: RowDict[];
};

function ImportPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: string; ok: number; failed: number; errors: string[] }[]>([]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setResult([]);
    const ps: Preview[] = [];
    for (const f of Array.from(files)) {
      try {
        const { headers, rows } = await readSheet(f);
        const kind = detectKind(headers);
        ps.push({ fileName: f.name, kind, headers, rows, sample: rows.slice(0, 3) });
      } catch (e: any) {
        toast.error(`${f.name}: ${e.message || "Failed to read file"}`);
      }
    }
    setPreviews(ps);
  };

  const runImport = async () => {
    if (previews.length === 0) return;
    setBusy(true);
    const out: { kind: string; ok: number; failed: number; errors: string[] }[] = [];
    // Cache clients lookup map (by normalized company_name)
    const clientMap = await loadClientMap();

    for (const p of previews) {
      if (p.kind === "unknown") {
        out.push({ kind: `${p.fileName} (unknown)`, ok: 0, failed: p.rows.length, errors: ["Could not detect data type from headers"] });
        continue;
      }
      const r = await importByKind(p.kind, p.rows, clientMap);
      out.push({ kind: `${p.fileName} → ${labelFor(p.kind)}`, ...r });
    }
    setResult(out);
    setBusy(false);
    setPreviews([]);
    if (inputRef.current) inputRef.current.value = "";
    const totalOk = out.reduce((s, x) => s + x.ok, 0);
    const totalFail = out.reduce((s, x) => s + x.failed, 0);
    if (totalFail === 0) toast.success(`Imported ${totalOk} rows successfully`);
    else toast.warning(`Imported ${totalOk} rows · ${totalFail} failed`);
  };

  return (
    <div className="mt-4 space-y-4">
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <UploadCloud className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold">Smart Excel Import</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Drop one or many .xlsx / .csv files. We'll detect what each file is (Clients, Renewals, AMC, Time
              Entries) by looking at its column headers and route every row to the right table — no mapping
              needed. Missing clients are created automatically by company name.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <Badge variant="outline" className="bg-muted/40">Clients · company name</Badge>
              <Badge variant="outline" className="bg-muted/40">Renewals · domain + expiries</Badge>
              <Badge variant="outline" className="bg-muted/40">AMC · start/end + allocated hours</Badge>
              <Badge variant="outline" className="bg-muted/40">Time Entries · developer + hours</Badge>
            </div>
          </div>
        </div>

        <label
          htmlFor="excel-input"
          className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/20 px-6 py-10 text-center transition hover:border-primary/40 hover:bg-accent/30"
        >
          <FileSpreadsheet className="mb-3 h-8 w-8 text-muted-foreground" />
          <div className="text-sm font-medium">Click to choose Excel files (or drop them here)</div>
          <div className="mt-1 text-xs text-muted-foreground">.xlsx, .xls, .csv — multiple files supported</div>
          <input
            id="excel-input"
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>
      </Card>

      {previews.length > 0 && (
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold">Preview ({previews.length} file{previews.length > 1 ? "s" : ""})</h3>
            <Button onClick={runImport} disabled={busy} className="bg-gradient-to-r from-primary to-primary-glow">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
              {busy ? "Importing..." : "Import all"}
            </Button>
          </div>
          <div className="space-y-4">
            {previews.map((p, i) => (
              <div key={i} className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{p.fileName}</div>
                    <div className="text-xs text-muted-foreground">{p.rows.length} rows · {p.headers.length} columns</div>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      p.kind === "unknown"
                        ? "border-destructive/30 bg-destructive/10 text-destructive"
                        : "border-primary/30 bg-primary/10 text-primary"
                    }
                  >
                    {p.kind === "unknown" ? "Unknown" : labelFor(p.kind)}
                  </Badge>
                </div>
                {p.headers.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {p.headers.slice(0, 16).map((h) => (
                      <span key={h} className="rounded-md bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground">
                        {h}
                      </span>
                    ))}
                    {p.headers.length > 16 && <span className="text-[11px] text-muted-foreground">+{p.headers.length - 16} more</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {result.length > 0 && (
        <Card className="p-6">
          <h3 className="mb-3 text-base font-semibold">Import results</h3>
          <div className="space-y-2">
            {result.map((r, i) => (
              <div key={i} className="flex items-start justify-between rounded-lg border border-border p-3">
                <div className="flex items-start gap-3">
                  {r.failed === 0 ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
                  ) : (
                    <AlertCircle className="mt-0.5 h-4 w-4 text-amber-500" />
                  )}
                  <div>
                    <div className="text-sm font-medium">{r.kind}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.ok} imported · {r.failed} failed
                    </div>
                    {r.errors.slice(0, 3).map((e, j) => (
                      <div key={j} className="mt-1 text-[11px] text-destructive">{e}</div>
                    ))}
                    {r.errors.length > 3 && (
                      <div className="text-[11px] text-muted-foreground">+{r.errors.length - 3} more errors</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function labelFor(k: string) {
  return { clients: "Clients", renewals: "Renewals", amc: "AMC Clients", time_entries: "Time Entries" }[k] || k;
}

async function loadClientMap(): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  const { data } = await supabase.from("clients").select("id, company_name");
  (data || []).forEach((c: any) => m.set(normName(c.company_name), c.id));
  return m;
}
function normName(s: string): string {
  return String(s || "").toLowerCase().trim().replace(/\s+/g, " ");
}

async function ensureClient(name: string | null, map: Map<string, string>): Promise<string | null> {
  if (!name) return null;
  const k = normName(name);
  if (!k) return null;
  if (map.has(k)) return map.get(k)!;
  const { data, error } = await supabase
    .from("clients")
    .insert({ company_name: name.trim(), client_type: "external" })
    .select("id")
    .single();
  if (error) throw new Error(`Create client "${name}" failed: ${error.message}`);
  map.set(k, data.id);
  return data.id;
}

async function importByKind(
  kind: "clients" | "renewals" | "amc" | "time_entries",
  rows: RowDict[],
  clientMap: Map<string, string>
) {
  let ok = 0,
    failed = 0;
  const errors: string[] = [];

  // For AMC mapping, build website→amcId after insert
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      if (kind === "clients") {
        const company = toStr(pick(row, ["company_name", "company name", "company", "client", "client name", "name"]));
        if (!company) throw new Error("Missing company name");
        // Skip if exists
        if (clientMap.has(normName(company))) {
          // Update with extra fields
          const id = clientMap.get(normName(company))!;
          await supabase.from("clients").update(buildClientPayload(row)).eq("id", id);
        } else {
          const payload = { company_name: company, ...buildClientPayload(row) };
          const { data, error } = await supabase.from("clients").insert(payload).select("id").single();
          if (error) throw error;
          clientMap.set(normName(company), data.id);
        }
      } else if (kind === "renewals") {
        const domain = toStr(pick(row, ["domain", "website", "url", "site"]));
        if (!domain) throw new Error("Missing domain");
        const companyName = toStr(pick(row, ["client", "company", "company_name", "company name", "client name"]));
        const client_id = await ensureClient(companyName, clientMap);
        const payload = {
          domain,
          client_id,
          service_type: toStr(pick(row, ["service_type", "service type", "service"])),
          ownership: toStr(pick(row, ["ownership", "owned by", "ownedby"])),
          registrar: toStr(pick(row, ["registrar"])),
          hosting_provider: toStr(pick(row, ["hosting_provider", "hosting provider", "hosting"])),
          domain_expiry: toDate(pick(row, ["domain_expiry", "domain expiry"])),
          hosting_expiry: toDate(pick(row, ["hosting_expiry", "hosting expiry"])),
          ga_expiry: toDate(pick(row, ["ga_expiry", "ga expiry", "google analytics expiry"])),
          mail_type: toStr(pick(row, ["mail_type", "mail type", "email type"])),
          email_count: toInt(pick(row, ["email_count", "email count", "mail count"])),
          contact_person: toStr(pick(row, ["contact_person", "contact person", "contact name"])),
          contact_emails: toEmails(pick(row, ["contact_emails", "contact emails", "emails", "email"])),
          phone_1: toStr(pick(row, ["phone_1", "phone 1", "phone", "mobile", "mobile 1"])),
          phone_2: toStr(pick(row, ["phone_2", "phone 2", "mobile 2", "alt phone"])),
          client_type: toClientType(pick(row, ["client_type", "client type", "type"])),
          notes: toStr(pick(row, ["notes", "remarks", "comments"])),
          panel_type: toStr(pick(row, ["panel_type", "panel type", "panel"])),
          admin_url: toStr(pick(row, ["admin_url", "admin url", "panel url", "cpanel url"])),
          ftp_host: toStr(pick(row, ["ftp_host", "ftp host", "ftp server"])),
          ftp_port: toInt(pick(row, ["ftp_port", "ftp port"])),
        };
        const { error } = await supabase.from("renewals").insert(payload);
        if (error) throw error;
      } else if (kind === "amc") {
        const companyName = toStr(pick(row, ["client", "company", "company_name", "company name", "client name"]));
        const client_id = await ensureClient(companyName, clientMap);
        const payload = {
          client_id,
          website: toStr(pick(row, ["website", "url", "domain", "site"])),
          bd_person: toStr(pick(row, ["bd_person", "bd person", "bd", "business developer", "owner"])),
          start_date: toDate(pick(row, ["start_date", "start date", "amc start", "from"])) || todayISO(),
          end_date: toDate(pick(row, ["end_date", "end date", "amc end", "to", "expiry"])) || todayISO(),
          allocated_hours: toNum(pick(row, ["allocated_hours", "allocated hours", "total hours", "hours"])) ?? 0,
          consumed_hours: toNum(pick(row, ["consumed_hours", "consumed hours", "used hours"])) ?? 0,
          is_active: toBool(pick(row, ["is_active", "active", "status"]), true),
          notes: toStr(pick(row, ["notes", "remarks", "comments"])),
        };
        const { error } = await supabase.from("amc_clients").insert(payload);
        if (error) throw error;
      } else if (kind === "time_entries") {
        const companyName = toStr(pick(row, ["client", "company", "company_name", "company name", "client name"]));
        const websiteName = toStr(pick(row, ["website", "url", "amc", "domain"]));
        const amc_client_id = await resolveAmcId(companyName, websiteName);
        if (!amc_client_id) throw new Error(`No matching AMC found for "${companyName || websiteName || "row"}"`);
        let hours = toInt(pick(row, ["hours", "hrs"])) ?? 0;
        let minutes = toInt(pick(row, ["minutes", "mins"])) ?? 0;
        const dur = toNum(pick(row, ["duration", "time", "hours_decimal"]));
        if (dur && hours === 0 && minutes === 0) {
          hours = Math.floor(dur);
          minutes = Math.round((dur - hours) * 60);
        }
        const payload = {
          amc_client_id,
          developer_name: toStr(pick(row, ["developer", "developer name", "developername", "user", "person", "by"])) || "Unknown",
          entry_date: toDate(pick(row, ["entry_date", "entry date", "date", "work date"])) || todayISO(),
          work_description: toStr(pick(row, ["work_description", "work description", "description", "task", "details", "work"])) || "",
          hours,
          minutes,
          is_billable: toBool(pick(row, ["is_billable", "billable", "is billable"]), true),
          status: (toStr(pick(row, ["status"])) || "approved").toLowerCase(),
        };
        const { error } = await supabase.from("time_entries").insert(payload as any);
        if (error) throw error;
      }
      ok++;
    } catch (e: any) {
      failed++;
      errors.push(`Row ${i + 2}: ${e.message || String(e)}`);
    }
  }
  return { ok, failed, errors };
}

function buildClientPayload(row: RowDict) {
  return {
    primary_contact: toStr(pick(row, ["primary_contact", "primary contact", "contact", "contact person"])),
    primary_email: toStr(pick(row, ["primary_email", "primary email", "email"])),
    primary_phone: toStr(pick(row, ["primary_phone", "primary phone", "phone", "mobile"])),
    billing_email: toStr(pick(row, ["billing_email", "billing email"])),
    billing_contact: toStr(pick(row, ["billing_contact", "billing contact"])),
    address: toStr(pick(row, ["address", "location"])),
    client_type: toClientType(pick(row, ["client_type", "client type", "type"])),
    notes: toStr(pick(row, ["notes", "remarks", "comments"])),
  };
}

async function resolveAmcId(company: string | null, website: string | null): Promise<string | null> {
  if (website) {
    const { data } = await supabase.from("amc_clients").select("id, website").ilike("website", website).limit(1);
    if (data && data.length) return data[0].id;
  }
  if (company) {
    const { data: c } = await supabase.from("clients").select("id").ilike("company_name", company).limit(1);
    if (c && c.length) {
      const { data: a } = await supabase.from("amc_clients").select("id").eq("client_id", c[0].id).limit(1);
      if (a && a.length) return a[0].id;
    }
  }
  return null;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/* ==================== EXPORT ==================== */

function ExportPanel() {
  const [counts, setCounts] = useState<{ clients: number; renewals: number; amc: number; te: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [a, b, c, d] = await Promise.all([
        supabase.from("clients").select("*", { count: "exact", head: true }),
        supabase.from("renewals").select("*", { count: "exact", head: true }),
        supabase.from("amc_clients").select("*", { count: "exact", head: true }),
        supabase.from("time_entries").select("*", { count: "exact", head: true }),
      ]);
      setCounts({ clients: a.count ?? 0, renewals: b.count ?? 0, amc: c.count ?? 0, te: d.count ?? 0 });
    })();
  }, []);

  const exportClients = async () => {
    setBusy("clients");
    const { data, error } = await supabase.from("clients").select("*").order("company_name");
    setBusy(null);
    if (error) return toast.error(error.message);
    downloadXlsx(`paarami-clients-${todayISO()}.xlsx`, [{ name: "Clients", rows: (data || []) as any[] }]);
    toast.success(`Exported ${data?.length ?? 0} clients`);
  };

  const exportRenewals = async () => {
    setBusy("renewals");
    const [{ data: r }, { data: c }] = await Promise.all([
      supabase.from("renewals").select("*").order("domain"),
      supabase.from("clients").select("id, company_name"),
    ]);
    setBusy(null);
    const cmap = new Map((c || []).map((x: any) => [x.id, x.company_name]));
    const rows = (r || []).map((x: any) => ({
      Domain: x.domain,
      Client: x.client_id ? cmap.get(x.client_id) || "" : "",
      Service_Type: x.service_type,
      Ownership: x.ownership,
      Registrar: x.registrar,
      Hosting_Provider: x.hosting_provider,
      Domain_Expiry: x.domain_expiry,
      Hosting_Expiry: x.hosting_expiry,
      GA_Expiry: x.ga_expiry,
      Mail_Type: x.mail_type,
      Email_Count: x.email_count,
      Contact_Person: x.contact_person,
      Contact_Emails: (x.contact_emails || []).join(", "),
      Phone_1: x.phone_1,
      Phone_2: x.phone_2,
      Client_Type: x.client_type,
      Panel_Type: x.panel_type,
      Admin_URL: x.admin_url,
      FTP_Host: x.ftp_host,
      FTP_Port: x.ftp_port,
      Notes: x.notes,
    }));
    downloadXlsx(`paarami-renewals-${todayISO()}.xlsx`, [{ name: "Renewals", rows }]);
    toast.success(`Exported ${rows.length} renewals`);
  };

  const exportAmcByClient = async () => {
    setBusy("amc");
    const [{ data: a }, { data: c }] = await Promise.all([
      supabase.from("amc_clients").select("*"),
      supabase.from("clients").select("id, company_name"),
    ]);
    setBusy(null);
    const cmap = new Map((c || []).map((x: any) => [x.id, x.company_name]));
    const grouped = new Map<string, any[]>();
    (a || []).forEach((x: any) => {
      const name = (x.client_id && cmap.get(x.client_id)) || "Unassigned";
      const arr = grouped.get(name) || [];
      arr.push({
        Website: x.website,
        BD_Person: x.bd_person,
        Start_Date: x.start_date,
        End_Date: x.end_date,
        Allocated_Hours: x.allocated_hours,
        Consumed_Hours: x.consumed_hours,
        Remaining_Hours: Number(x.allocated_hours) - Number(x.consumed_hours),
        Active: x.is_active,
        Notes: x.notes,
      });
      grouped.set(name, arr);
    });
    const sheets = Array.from(grouped.entries()).map(([name, rows]) => ({ name: safeFilename(name), rows }));
    if (sheets.length === 0) return toast.error("No AMC data to export");
    downloadXlsx(`paarami-amc-by-client-${todayISO()}.xlsx`, sheets);
    toast.success(`Exported AMCs for ${sheets.length} clients`);
  };

  const exportTimeByClient = async () => {
    setBusy("te");
    const [{ data: t }, { data: a }, { data: c }] = await Promise.all([
      supabase.from("time_entries").select("*").order("entry_date", { ascending: false }),
      supabase.from("amc_clients").select("id, client_id, website"),
      supabase.from("clients").select("id, company_name"),
    ]);
    setBusy(null);
    const cmap = new Map((c || []).map((x: any) => [x.id, x.company_name]));
    const amap = new Map((a || []).map((x: any) => [x.id, x]));
    const grouped = new Map<string, any[]>();
    (t || []).forEach((x: any) => {
      const amc = amap.get(x.amc_client_id);
      const name = (amc && amc.client_id && cmap.get(amc.client_id)) || (amc?.website) || "Unassigned";
      const arr = grouped.get(name) || [];
      arr.push({
        Date: x.entry_date,
        Developer: x.developer_name,
        Website: amc?.website || "",
        Hours: x.hours,
        Minutes: x.minutes,
        Total_Hours: Number(x.hours) + Number(x.minutes) / 60,
        Billable: x.is_billable,
        Status: x.status,
        Description: x.work_description,
      });
      grouped.set(name, arr);
    });
    const sheets = Array.from(grouped.entries()).map(([name, rows]) => ({ name: safeFilename(name), rows }));
    if (sheets.length === 0) return toast.error("No time entries to export");
    downloadXlsx(`paarami-time-entries-by-client-${todayISO()}.xlsx`, sheets);
    toast.success(`Exported time entries for ${sheets.length} clients`);
  };

  const cards = [
    {
      key: "clients",
      label: "All Clients",
      desc: "One sheet — full client master list.",
      icon: Users,
      count: counts?.clients,
      onClick: exportClients,
    },
    {
      key: "renewals",
      label: "All Renewals",
      desc: "Domain, hosting, GA, contacts (no credentials).",
      icon: RefreshCw,
      count: counts?.renewals,
      onClick: exportRenewals,
    },
    {
      key: "amc",
      label: "AMC by Client",
      desc: "One workbook · one sheet per client with their AMCs.",
      icon: Wrench,
      count: counts?.amc,
      onClick: exportAmcByClient,
    },
    {
      key: "te",
      label: "Time Entries by Client",
      desc: "One workbook · one sheet per client with all time entries.",
      icon: Clock,
      count: counts?.te,
      onClick: exportTimeByClient,
    },
  ];

  return (
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Card key={c.key} className="p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{c.label}</h3>
                  <Badge variant="outline" className="text-xs">{c.count ?? "—"} rows</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{c.desc}</p>
                <Button size="sm" className="mt-4" variant="outline" onClick={c.onClick} disabled={busy === c.key}>
                  {busy === c.key ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  Download .xlsx
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
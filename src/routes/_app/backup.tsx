import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Upload, Database, ShieldAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { WarningConfirmDialog } from "@/components/warning-confirm-dialog";
import { logActivity } from "@/lib/activity-log";

export const Route = createFileRoute("/_app/backup")({ component: BackupPage });

function BackupPage() {
  const { isSuperAdmin } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pending, setPending] = useState<{ data: any; mode: "replace" | "merge" } | null>(null);
  const [lastReport, setLastReport] = useState<Record<string, any> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!isSuperAdmin) {
    return <div className="rounded-md border bg-card p-8 text-center text-muted-foreground">Super Admin access required.</div>;
  }

  const doExport = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("db-backup", { body: { action: "export" } });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      a.download = `paarami-backup-${stamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
      const totalRows = Object.values((data as any).tables || {}).reduce(
        (s: number, arr: any) => s + (Array.isArray(arr) ? arr.length : 0), 0,
      );
      toast.success(`Backup downloaded — ${totalRows} rows across ${Object.keys((data as any).tables || {}).length} tables`);
      void logActivity({ action: "export", entity: "import_export", description: `Downloaded full DB backup (${totalRows} rows)` });
    } catch (e: any) {
      toast.error(e.message || "Export failed");
    } finally { setExporting(false); }
  };

  const chooseFile = (mode: "replace" | "merge") => {
    const input = fileRef.current;
    if (!input) return;
    input.onchange = async () => {
      const f = input.files?.[0];
      input.value = "";
      if (!f) return;
      try {
        const text = await f.text();
        const parsed = JSON.parse(text);
        if (!parsed.tables) throw new Error("Not a valid Paarami backup file (missing 'tables').");
        setPending({ data: parsed, mode });
      } catch (e: any) {
        toast.error(`Invalid file: ${e.message}`);
      }
    };
    input.click();
  };

  const runImport = async () => {
    if (!pending) return;
    setImporting(true);
    setLastReport(null);
    try {
      const { data, error } = await supabase.functions.invoke("db-backup", {
        body: { action: "import", mode: pending.mode, data: pending.data },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      setLastReport((data as any).report || {});
      const failed = Object.entries((data as any).report || {})
        .filter(([, v]: any) => v?.error).map(([k]) => k);
      if (failed.length) toast.warning(`Restore finished with errors: ${failed.join(", ")}`);
      else toast.success(`Database restored (mode: ${pending.mode})`);
      void logActivity({ action: "import", entity: "import_export", description: `Restored full DB backup (${pending.mode})` });
    } catch (e: any) {
      toast.error(e.message || "Restore failed");
    } finally {
      setImporting(false);
      setPending(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Database Backup & Restore"
        description="Full JSON snapshot of every portal table. Super Admin only."
      />

      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 shrink-0 text-destructive" />
          <div>
            <div className="font-semibold text-destructive">Handle with care</div>
            <p className="mt-1 text-muted-foreground">
              The backup contains <b>all portal data</b> including encrypted credential blobs. Store it securely.
              Restoring in <b>Replace</b> mode wipes existing rows in every table (except <code>user_profiles</code> and <code>app_settings</code>) and re-inserts the snapshot.
              Use <b>Merge</b> mode to upsert without deleting.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Download className="h-4 w-4" /> Export</CardTitle>
            <CardDescription>Download a complete JSON backup of every table.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={doExport} disabled={exporting} className="bg-gradient-to-r from-primary to-primary-glow">
              {exporting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Exporting...</> : <><Download className="mr-2 h-4 w-4" />Download backup</>}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Upload className="h-4 w-4" /> Restore</CardTitle>
            <CardDescription>Pick a previously-downloaded JSON backup.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" />
            <div className="flex flex-wrap gap-2">
              <Button variant="destructive" onClick={() => chooseFile("replace")} disabled={importing}>
                <Upload className="mr-2 h-4 w-4" /> Restore (Replace)
              </Button>
              <Button variant="outline" onClick={() => chooseFile("merge")} disabled={importing}>
                <Upload className="mr-2 h-4 w-4" /> Restore (Merge / Upsert)
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Replace wipes existing rows. Merge keeps current data and upserts the backup by primary key.
            </p>
          </CardContent>
        </Card>
      </div>

      {lastReport && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Database className="h-4 w-4" /> Last restore report</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase">
                  <tr><th className="p-3">Table</th><th className="p-3 text-right">Inserted</th><th className="p-3 text-right">Deleted</th><th className="p-3">Status</th></tr>
                </thead>
                <tbody>
                  {Object.entries(lastReport).map(([t, v]: any) => (
                    <tr key={t} className="border-t">
                      <td className="p-3 font-mono">{t}</td>
                      <td className="p-3 text-right">{v.inserted ?? 0}</td>
                      <td className="p-3 text-right">{v.deleted ?? "—"}</td>
                      <td className="p-3">{v.error
                        ? <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">{v.error}</Badge>
                        : <Badge variant="outline" className="bg-success/10 text-success border-success/20">OK</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <WarningConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title={pending?.mode === "replace" ? "Replace ENTIRE database?" : "Merge backup into database?"}
        description={pending ? (
          <>
            File contains <b>{Object.keys(pending.data.tables || {}).length}</b> tables{" "}
            (<b>{Object.values(pending.data.tables || {}).reduce(
              (s: number, a: any) => s + (Array.isArray(a) ? a.length : 0), 0,
            )}</b> rows total).<br />
            {pending.mode === "replace"
              ? <>This will <b>delete every existing row</b> (except user profiles and app settings) and re-insert the snapshot. There is no automatic undo.</>
              : <>Rows in the backup will be <b>upserted by primary key</b>. Existing rows not in the backup will be kept.</>}
          </>
        ) : ""}
        confirmLabel={pending?.mode === "replace" ? "Replace database" : "Merge data"}
        requireText={pending?.mode === "replace" ? "REPLACE" : "MERGE"}
        onConfirm={runImport}
      />
    </div>
  );
}
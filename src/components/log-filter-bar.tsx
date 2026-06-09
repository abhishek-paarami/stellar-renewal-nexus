import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export type Preset = "today" | "7d" | "30d" | "90d" | "all";

export function rangeFor(p: Preset): { from: string | null; to: string | null } {
  const now = new Date();
  const iso = (d: Date) => d.toISOString();
  if (p === "all") return { from: null, to: null };
  if (p === "today") {
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    return { from: iso(start), to: iso(now) };
  }
  const days = p === "7d" ? 7 : p === "30d" ? 30 : 90;
  const start = new Date(now.getTime() - days * 86400000);
  return { from: iso(start), to: iso(now) };
}

export function useLogFilter(defaultPreset: Preset = "today") {
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

export function LogFilterBar({
  preset, setPreset, from, to, setFrom, setTo, onExport,
}: {
  preset: Preset; setPreset: (p: Preset) => void;
  from: string; to: string; setFrom: (v: string) => void; setTo: (v: string) => void;
  onExport?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
      <div className="flex rounded-md border border-border bg-muted/30 p-0.5 text-xs">
        {(["today", "7d", "30d", "90d", "all"] as Preset[]).map((p) => (
          <button key={p} onClick={() => setPreset(p)}
            className={`px-3 py-1 rounded ${preset === p ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}>
            {p === "all" ? "All" : p === "today" ? "Today" : `Last ${p}`}
          </button>
        ))}
      </div>
      <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPreset("all"); }} className="h-8 w-40" />
      <span className="text-xs text-muted-foreground">to</span>
      <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPreset("all"); }} className="h-8 w-40" />
      {onExport && (
        <Button variant="outline" size="sm" className="ml-auto" onClick={onExport}>
          <Download className="mr-2 h-3 w-3" /> Export CSV
        </Button>
      )}
    </div>
  );
}
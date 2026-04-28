import * as XLSX from "xlsx";

export type RowDict = Record<string, any>;

/** Normalize header: lowercase, strip non-alnum. */
export function norm(s: string): string {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Read first sheet of a file as array of dict rows (header row = first row). */
export async function readSheet(file: File): Promise<{ headers: string[]; rows: RowDict[] }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json: RowDict[] = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false });
  const headers =
    json.length > 0 ? Object.keys(json[0]) : (XLSX.utils.sheet_to_json(ws, { header: 1 })[0] as string[]) || [];
  return { headers, rows: json };
}

/** Pick first matching value from a row using a list of candidate header names (lenient match). */
export function pick(row: RowDict, candidates: string[]): any {
  const keys = Object.keys(row);
  for (const c of candidates) {
    const cn = norm(c);
    const k = keys.find((k) => norm(k) === cn);
    if (k != null && row[k] !== "" && row[k] != null) return row[k];
  }
  return null;
}

/** Coerce to ISO date string (YYYY-MM-DD) or null. */
export function toDate(v: any): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    // Excel serial
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y.toString().padStart(4, "0")}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  // try common formats
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  // dd-mm-yyyy or dd/mm/yyyy
  const m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const yyyy = y.length === 2 ? `20${y}` : y;
    return `${yyyy}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

export function toNum(v: any): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : n;
}

export function toInt(v: any): number | null {
  const n = toNum(v);
  return n == null ? null : Math.round(n);
}

export function toStr(v: any): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export function toBool(v: any, dflt = true): boolean {
  if (v == null || v === "") return dflt;
  const s = String(v).toLowerCase().trim();
  return ["1", "true", "yes", "y", "billable", "active"].includes(s);
}

export function toEmails(v: any): string[] {
  if (!v) return [];
  return String(v)
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));
}

export function toClientType(v: any): "internal" | "external" {
  const s = (toStr(v) || "external").toLowerCase();
  return s.includes("intern") || s === "in" ? "internal" : "external";
}

/** Detect kind by headers — returns one of clients, renewals, amc, time_entries. */
export function detectKind(headers: string[]): "clients" | "renewals" | "amc" | "time_entries" | "unknown" {
  const set = new Set(headers.map(norm));
  const has = (...ks: string[]) => ks.some((k) => set.has(norm(k)));

  // Time entries: must have hours / minutes + developer + entry date
  if ((has("hours", "duration") || has("minutes")) && has("developer", "developername", "developer name", "user", "person")) {
    return "time_entries";
  }
  // AMC: allocated hours / start_date + end_date
  if (has("allocatedhours", "allocated hours", "totalhours", "hours allocated") || (has("startdate", "start date") && has("enddate", "end date"))) {
    return "amc";
  }
  // Renewals: domain + any expiry
  if (has("domain") && has("domainexpiry", "domain expiry", "hostingexpiry", "hosting expiry", "gaexpiry", "ga expiry", "expiry", "expirydate")) {
    return "renewals";
  }
  if (has("domain", "registrar", "hostingprovider")) return "renewals";
  // Clients: company name
  if (has("companyname", "company name", "client", "clientname", "company")) return "clients";

  return "unknown";
}

/** Build & download an .xlsx from list of sheets. */
export function downloadXlsx(filename: string, sheets: { name: string; rows: RowDict[] }[]) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.rows.length ? s.rows : [{}]);
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31) || "Sheet");
  }
  XLSX.writeFile(wb, filename);
}

export function safeFilename(s: string): string {
  return s.replace(/[\/\\?%*:|"<>]/g, "_").slice(0, 80);
}
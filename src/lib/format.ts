export function fmtDate(d?: string | Date | null) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function daysUntil(d?: string | Date | null): number | null {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return null;
  const ms = date.getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function expiryStatus(d?: string | Date | null): {
  label: string;
  variant: "expired" | "critical" | "warning" | "ok" | "none";
  days: number | null;
} {
  const days = daysUntil(d);
  if (days === null) return { label: "—", variant: "none", days: null };
  if (days < 0) return { label: `Expired ${Math.abs(days)}d ago`, variant: "expired", days };
  if (days <= 7) return { label: `${days}d left`, variant: "critical", days };
  if (days <= 30) return { label: `${days}d left`, variant: "warning", days };
  return { label: `${days}d left`, variant: "ok", days };
}

export const statusColors: Record<string, string> = {
  expired: "bg-destructive/10 text-destructive border-destructive/20",
  critical: "bg-destructive/10 text-destructive border-destructive/20",
  warning: "bg-warning/15 text-warning border-warning/20",
  ok: "bg-success/10 text-success border-success/20",
  none: "bg-muted text-muted-foreground border-border",
};
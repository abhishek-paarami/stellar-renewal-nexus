import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import {
  RefreshCw,
  Wrench,
  Users,
  AlertTriangle,
  Clock,
  TrendingUp,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtDate, expiryStatus, statusColors } from "@/lib/format";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

interface Stats {
  totalClients: number;
  totalRenewals: number;
  totalAmc: number;
  expiringSoon: number;
  expired: number;
  hoursThisMonth: number;
}

interface UpcomingRow {
  id: string;
  domain: string;
  kind: string;
  date: string;
}

function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const [{ count: clients }, { count: renewals }, { count: amc }, renewalsData, timeData] =
      await Promise.all([
        supabase.from("clients").select("*", { count: "exact", head: true }),
        supabase.from("renewals").select("*", { count: "exact", head: true }),
        supabase.from("amc_clients").select("*", { count: "exact", head: true }),
        supabase
          .from("renewals")
          .select("id, domain, domain_expiry, hosting_expiry, ga_expiry"),
        supabase
          .from("time_entries")
          .select("hours, minutes, entry_date, status")
          .gte("entry_date", monthStart()),
      ]);

    let expiringSoon = 0;
    let expired = 0;
    const upcomingRows: UpcomingRow[] = [];
    (renewalsData.data || []).forEach((r: any) => {
      [
        ["domain", r.domain_expiry],
        ["hosting", r.hosting_expiry],
        ["GA", r.ga_expiry],
      ].forEach(([kind, date]) => {
        if (!date) return;
        const s = expiryStatus(date as string);
        if (s.variant === "expired") expired++;
        if (s.variant === "warning" || s.variant === "critical") expiringSoon++;
        if (s.days !== null && s.days <= 60) {
          upcomingRows.push({ id: r.id, domain: r.domain, kind: kind as string, date: date as string });
        }
      });
    });
    upcomingRows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const hoursThisMonth = (timeData.data || [])
      .filter((t: any) => t.status === "approved")
      .reduce((sum: number, t: any) => sum + Number(t.hours) + Number(t.minutes) / 60, 0);

    setStats({
      totalClients: clients ?? 0,
      totalRenewals: renewals ?? 0,
      totalAmc: amc ?? 0,
      expiringSoon,
      expired,
      hoursThisMonth: Math.round(hoursThisMonth * 10) / 10,
    });
    setUpcoming(upcomingRows.slice(0, 8));
    setLoading(false);
  }

  const cards = [
    {
      label: "Total Clients",
      value: stats?.totalClients ?? "—",
      icon: Users,
      tint: "from-blue-500/10 to-blue-500/0 text-blue-600",
    },
    {
      label: "Active Renewals",
      value: stats?.totalRenewals ?? "—",
      icon: RefreshCw,
      tint: "from-violet-500/10 to-violet-500/0 text-violet-600",
    },
    {
      label: "AMC Clients",
      value: stats?.totalAmc ?? "—",
      icon: Wrench,
      tint: "from-emerald-500/10 to-emerald-500/0 text-emerald-600",
    },
    {
      label: "Expiring (≤30d)",
      value: stats?.expiringSoon ?? "—",
      icon: AlertTriangle,
      tint: "from-amber-500/10 to-amber-500/0 text-amber-600",
    },
    {
      label: "Expired",
      value: stats?.expired ?? "—",
      icon: AlertTriangle,
      tint: "from-rose-500/10 to-rose-500/0 text-rose-600",
    },
    {
      label: "Hours This Month",
      value: stats?.hoursThisMonth ?? "—",
      icon: Clock,
      tint: "from-cyan-500/10 to-cyan-500/0 text-cyan-600",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
            >
              <Card className="overflow-hidden border-border">
                <CardContent className="p-5">
                  <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${c.tint}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="text-2xl font-bold tracking-tight">
                    {loading ? "…" : c.value}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{c.label}</div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Upcoming Expiries</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Domains, hosting & GA expiring in the next 60 days
              </p>
            </div>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-0">
            {upcoming.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                {loading ? "Loading..." : "No upcoming expiries 🎉"}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {upcoming.map((u) => {
                  const s = expiryStatus(u.date);
                  return (
                    <Link
                      key={u.id + u.kind}
                      to="/renewals"
                      className="flex items-center justify-between px-5 py-3 transition hover:bg-accent/40"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{u.domain}</div>
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">
                          {u.kind} · {fmtDate(u.date)}
                        </div>
                      </div>
                      <Badge variant="outline" className={statusColors[s.variant]}>
                        {s.label}
                      </Badge>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <QuickLink to="/renewals" icon={RefreshCw} label="Manage Renewals" />
            <QuickLink to="/amc" icon={Wrench} label="AMC Clients" />
            <QuickLink to="/time-entries" icon={Clock} label="Log Time Entry" />
            <QuickLink to="/clients" icon={Users} label="Add New Client" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QuickLink({ to, icon: Icon, label }: { to: any; icon: any; label: string }) {
  return (
    <Link
      to={to}
      className="group flex items-center justify-between rounded-lg border border-border bg-card p-3 transition hover:border-primary/40 hover:bg-accent/40"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <TrendingUp className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" />
    </Link>
  );
}

function monthStart(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
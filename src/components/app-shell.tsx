import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard,
  Users,
  RefreshCw,
  Wrench,
  Clock,
  KeyRound,
  Mail,
  Settings,
  Shield,
  LogOut,
  Bell,
  ChevronDown,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, role: "all" as const },
  { to: "/clients", label: "Clients", icon: Users, role: "all" as const },
  { to: "/renewals", label: "Renewals", icon: RefreshCw, role: "all" as const },
  { to: "/amc", label: "AMC Clients", icon: Wrench, role: "all" as const },
  { to: "/time-entries", label: "Time Entries", icon: Clock, role: "all" as const },
  { to: "/credentials", label: "Credentials Vault", icon: KeyRound, role: "super_admin" as const },
  { to: "/email-templates", label: "Email Templates", icon: Mail, role: "super_admin" as const },
  { to: "/users", label: "User Management", icon: Shield, role: "super_admin" as const },
  { to: "/import-export", label: "Import / Export", icon: FileSpreadsheet, role: "super_admin" as const },
  { to: "/settings", label: "Settings", icon: Settings, role: "super_admin" as const },
];

export function AppShell() {
  const { profile, signOut, isSuperAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const initials = (profile?.full_name || profile?.email || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border lg:flex"
        style={{ background: "var(--gradient-sidebar)" }}
      >
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border/60 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-glow shadow-md">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="text-sm font-semibold text-sidebar-foreground">Paarami Portal</div>
            <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50">
              Renewal & AMC
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV.filter((n) => n.role === "all" || isSuperAdmin).map((n) => {
            const Icon = n.icon;
            const active = location.pathname === n.to || location.pathname.startsWith(n.to + "/");
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary-glow" />
                )}
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border/60 p-4">
          <div className="rounded-lg bg-sidebar-accent/40 p-3 text-xs text-sidebar-foreground/70">
            <div className="font-semibold text-sidebar-foreground">Need help?</div>
            <div className="mt-1">Contact your Super Admin for access changes.</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-md">
          <div>
            <h1 className="text-lg font-semibold">{titleFromPath(location.pathname)}</h1>
            <p className="text-xs text-muted-foreground">
              {profile?.role === "super_admin" ? "Super Admin workspace" : "Manager workspace"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full p-1 pr-3 transition hover:bg-accent">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-gradient-to-br from-primary to-primary-glow text-xs text-primary-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden text-left sm:block">
                    <div className="text-sm font-medium leading-tight">{profile?.full_name}</div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {profile?.role.replace("_", " ")}
                    </div>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="font-medium">{profile?.full_name}</div>
                  <div className="text-xs font-normal text-muted-foreground">{profile?.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await signOut();
                    navigate({ to: "/login" });
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function titleFromPath(path: string): string {
  const seg = path.split("/").filter(Boolean)[0];
  const map: Record<string, string> = {
    dashboard: "Dashboard",
    clients: "Clients",
    renewals: "Renewals",
    amc: "AMC Clients",
    "time-entries": "Time Entries",
    credentials: "Credentials Vault",
    "email-templates": "Email Templates",
    users: "User Management",
    "import-export": "Import / Export",
    settings: "Settings",
  };
  return map[seg] || "Paarami Portal";
}
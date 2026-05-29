import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Lock, Mail, ShieldCheck, Sparkles, Activity, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logActivity } from "@/lib/activity-log";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signIn, session, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard" });
  }, [session, loading, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    setSubmitting(false);
    if (error) {
      toast.error("Sign-in failed", { description: error });
      return;
    }
    void logActivity({ action: "login", description: `Signed in as ${email.trim()}` });
    toast.success("Welcome back!");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#070d24] text-white">
      {/* Ambient gradient field */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 h-[640px] w-[640px] rounded-full bg-[radial-gradient(circle_at_center,rgba(80,120,255,0.35),transparent_60%)] blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-[640px] w-[640px] rounded-full bg-[radial-gradient(circle_at_center,rgba(120,80,255,0.28),transparent_60%)] blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,13,36,0)_0%,rgba(7,13,36,0.55)_70%,rgba(7,13,36,0.9)_100%)]" />
        <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,0.4)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.4)_1px,transparent_1px)] [background-size:48px_48px]" />
      </div>

      {/* Top brand bar */}
      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-6 pt-6 lg:px-10">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-white/[0.04] p-2 ring-1 ring-white/10 backdrop-blur">
            <img src="/logo.png" alt="Paarami Digital" className="h-7 w-auto" />
          </div>
          <div className="hidden flex-col leading-tight sm:flex">
            <span className="text-sm font-medium text-white/80">Internal Operations Portal</span>
          </div>
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/70 backdrop-blur md:flex">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          All systems operational
        </div>
      </header>

      <div className="relative z-10 mx-auto grid w-full max-w-7xl flex-1 items-center gap-12 px-6 py-10 lg:grid-cols-[1.05fr_minmax(380px,440px)] lg:gap-16 lg:px-10 lg:py-12">
        {/* Left: marketing pane */}
        <section className="hidden flex-col justify-center lg:flex">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white/60 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              Enterprise · Audited · Secure
            </div>
            <h1 className="text-[44px] font-semibold leading-[1.05] tracking-tight xl:text-[56px]">
              One workspace for every<br />
              <span style={{ color: "#FABC34" }}>renewal, AMC, and client hour</span>
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-white/65">
              The Paarami Internal Operations Portal centralizes domain & hosting renewals, AMC
              hour tracking, encrypted credential vaults, and team activity — purpose-built for
              the operations and account-management teams.
            </p>
            <div className="grid max-w-xl grid-cols-3 gap-3">
              {[
                { Icon: ShieldCheck, k: "Vault Secured", v: "AES-encrypted credentials with audited access" },
                { Icon: Activity, k: "Always Tracked", v: "Every create, edit, and delete is logged" },
                { Icon: Sparkles, k: "Auto Reminders", v: "Domain, hosting, GA and AMC alerts" },
              ].map(({ Icon, k, v }) => (
                <div
                  key={k}
                  className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur transition hover:border-white/20 hover:bg-white/[0.05]"
                >
                  <Icon className="h-4 w-4" style={{ color: "#FABC34" }} />
                  <div className="mt-3 text-sm font-medium text-white">{k}</div>
                  <div className="mt-1 text-[11px] leading-snug text-white/55">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Right: sign-in card */}
        <section className="flex items-center justify-center">
          <div className="w-full max-w-md">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-8 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
              <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

              <div className="mb-6 flex flex-col items-center text-center lg:hidden">
                <img src="/logo.png" alt="Paarami Digital" className="h-8 w-auto" />
                <div className="mt-2 text-[10px] uppercase tracking-[0.28em] text-white/55">
                  Internal Operations Portal
                </div>
              </div>

              <div>
                <div className="text-[11px] uppercase tracking-[0.28em] text-white/45">Welcome back</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                  Sign in to <span style={{ color: "#FABC34" }}>continue</span>
                </h2>
                <p className="mt-2 text-sm text-white/55">
                  Use the team credentials issued by your Super Admin.
                </p>
              </div>

              <form onSubmit={onSubmit} className="mt-7 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wider text-white/55">
                    Work email
                  </Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@paaramidigital.com"
                      className="h-11 border-white/10 bg-white/[0.04] pl-10 text-white placeholder:text-white/35 focus-visible:border-white/30 focus-visible:ring-0"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wider text-white/55">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-11 border-white/10 bg-white/[0.04] pl-10 text-white placeholder:text-white/35 focus-visible:border-white/30 focus-visible:ring-0"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="group h-11 w-full bg-white text-slate-900 shadow-lg shadow-black/30 hover:bg-white/90"
                >
                  {submitting ? (
                    <span className="inline-flex items-center gap-2 text-sm font-semibold">
                      <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-center gap-2 text-sm font-semibold">
                      Sign in securely
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  )}
                </Button>
              </form>

              <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-[11px] text-white/45">
                <span>Need access? Contact your Super Admin.</span>
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" /> SSL secured
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Footer pinned to bottom */}
      <footer className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-6 text-[11px] text-white/40 lg:px-10">
        <div className="flex items-center justify-between border-t border-white/10 pt-4">
          <span>© {new Date().getFullYear()} Paarami Digital. Internal use only.</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-white/40" /> v1.0
          </span>
        </div>
      </footer>
    </div>
  );
}
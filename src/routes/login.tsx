import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Lock, Mail, Shield } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    toast.success("Welcome back!");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-sidebar">
      {/* Decorative gradient orbs */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-primary/30 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full bg-primary-glow/25 blur-[120px]" />

      <div className="relative z-10 grid min-h-screen lg:grid-cols-2">
        {/* Brand panel */}
        <div className="hidden flex-col justify-between p-12 lg:flex">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3 text-sidebar-foreground"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-glow shadow-lg">
              <Shield className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <div className="text-base font-semibold tracking-tight">Paarami Digital</div>
              <div className="text-xs text-sidebar-foreground/60">Internal Operations Portal</div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="space-y-6 text-sidebar-foreground"
          >
            <h1 className="text-5xl font-bold leading-tight tracking-tight">
              Renewal & AMC<br />
              <span className="bg-gradient-to-r from-primary-glow to-accent-foreground bg-clip-text text-transparent">
                Management Portal
              </span>
            </h1>
            <p className="max-w-md text-base text-sidebar-foreground/70">
              Track every domain, hosting expiry, GA renewal, and AMC support hour
              for all Paarami Digital clients — in one secure, audited workspace.
            </p>
            <div className="grid grid-cols-3 gap-4 pt-4 text-sm">
              {[
                { k: "Encrypted", v: "Vault-protected credentials" },
                { k: "Automated", v: "30 / 7 / 1 day reminders" },
                { k: "Audited", v: "Every access logged" },
              ].map((f) => (
                <div key={f.k} className="rounded-xl border border-sidebar-border/40 bg-sidebar-accent/30 p-3 backdrop-blur">
                  <div className="font-semibold text-sidebar-foreground">{f.k}</div>
                  <div className="mt-1 text-xs text-sidebar-foreground/60">{f.v}</div>
                </div>
              ))}
            </div>
          </motion.div>

          <div className="text-xs text-sidebar-foreground/40">
            © {new Date().getFullYear()} Paarami Digital · Internal use only
          </div>
        </div>

        {/* Login card */}
        <div className="flex items-center justify-center p-6 lg:p-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            <div className="rounded-2xl border border-border bg-card p-8 shadow-2xl">
              <div className="mb-8 text-center lg:hidden">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-glow">
                  <Shield className="h-6 w-6 text-primary-foreground" />
                </div>
                <h2 className="mt-3 text-lg font-semibold">Paarami Portal</h2>
              </div>

              <h2 className="text-2xl font-bold tracking-tight">Sign in to your account</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Use your team credentials provided by the Super Admin.
              </p>

              <form onSubmit={onSubmit} className="mt-8 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@paaramidigital.com"
                      className="h-11 pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-11 pl-10"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-11 w-full bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-lg hover:opacity-95"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </form>

              <p className="mt-6 text-center text-xs text-muted-foreground">
                Need access? Contact your Super Admin.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Shield, KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { fmtDate } from "@/lib/format";
import { logActivity } from "@/lib/activity-log";

export const Route = createFileRoute("/_app/users")({ component: UsersPage });

interface ProfileRow {
  id: string; full_name: string; email: string;
  role: "super_admin" | "manager"; is_active: boolean;
  last_login: string | null; created_at: string;
}

function UsersPage() {
  const { user, isSuperAdmin } = useAuth();
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<ProfileRow | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("user_profiles").select("*").order("created_at");
    if (error) toast.error(error.message);
    setRows((data as any) || []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  if (!isSuperAdmin) return <div className="p-8 text-center text-muted-foreground">Super Admin access required.</div>;

  const updateRole = async (id: string, role: "super_admin" | "manager") => {
    const { error } = await supabase.from("user_profiles").update({ role }).eq("id", id);
    if (error) return toast.error(error.message);
    const u = rows.find((r) => r.id === id);
    void logActivity({ action: "update", entity: "user", entityId: id,
      description: `Changed role of ${u?.email || ""} to ${role}` });
    toast.success("Role updated"); void load();
  };

  const toggleActive = async (id: string, is_active: boolean) => {
    const { error } = await supabase.from("user_profiles").update({ is_active }).eq("id", id);
    if (error) return toast.error(error.message);
    const u = rows.find((r) => r.id === id);
    void logActivity({ action: "user_toggle_active", entity: "user", entityId: id,
      description: `${is_active ? "Activated" : "Deactivated"} user ${u?.email || ""}` });
    toast.success(is_active ? "User activated" : "User deactivated"); void load();
  };

  const deleteUser = async (row: ProfileRow) => {
    if (row.id === user?.id) return toast.error("You cannot delete yourself");
    if (!confirm(`Permanently delete ${row.email}? This cannot be undone.`)) return;
    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: { action: "delete", user_id: row.id },
    });
    if (error) return toast.error(error.message);
    if ((data as any)?.error) return toast.error((data as any).error);
    void logActivity({ action: "user_delete", entity: "user", entityId: row.id,
      description: `Deleted user ${row.email}` });
    toast.success("User deleted"); void load();
  };

  return (
    <div>
      <PageHeader
        title="User Management"
        description="Invite team members, control roles, and deactivate access."
        actions={
          <Button onClick={() => setOpen(true)} className="bg-gradient-to-r from-primary to-primary-glow">
            <Plus className="mr-2 h-4 w-4" /> Invite User
          </Button>
        }
      />

      {loading ? <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div> : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Login</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-accent/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.full_name}</div>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Select value={r.role} onValueChange={(v) => updateRole(r.id, v as any)} disabled={r.id === user?.id}>
                      <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Switch checked={r.is_active} onCheckedChange={(v) => toggleActive(r.id, v)} disabled={r.id === user?.id} />
                      <Badge variant="outline" className={r.is_active ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"}>
                        {r.is_active ? "Active" : "Disabled"}
                      </Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.last_login ? fmtDate(r.last_login) : "Never"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(r.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setResetTarget(r)} title="Reset password">
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon" variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteUser(r)}
                        disabled={r.id === user?.id}
                        title="Delete user"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <InviteDialog open={open} onOpenChange={setOpen} onSaved={() => { setOpen(false); void load(); }} />
      {resetTarget && (
        <ResetPasswordDialog
          target={resetTarget}
          onClose={() => setResetTarget(null)}
        />
      )}
    </div>
  );
}

function InviteDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [form, setForm] = useState({ full_name: "", email: "", password: "", role: "manager" as "manager" | "super_admin" });
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password || !form.full_name) return toast.error("All fields required");
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: { action: "create", email: form.email, password: form.password, full_name: form.full_name, role: form.role },
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    if ((data as any)?.error) return toast.error((data as any).error);
    const em = (data as any)?.email;
    if (em?.sent) toast.success("User created — welcome email sent");
    else toast.success(`User created${em?.error ? ` (email failed: ${em.error})` : ""}`);
    void logActivity({ action: "user_invite", entity: "user",
      description: `Invited ${form.email} as ${form.role}` });
    setForm({ full_name: "", email: "", password: "", role: "manager" });
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Shield className="h-4 w-4" /> Invite User</DialogTitle>
          <DialogDescription>Create a portal account for a team member.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2"><Label>Full Name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></div>
          <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
          <div className="space-y-2"><Label>Temporary Password</Label><Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} /></div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Creating..." : "Create User"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ target, onClose }: { target: ProfileRow; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: { action: "reset_password", user_id: target.id, password },
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    if ((data as any)?.error) return toast.error((data as any).error);
    const em = (data as any)?.email;
    if (em?.sent) toast.success("Password reset — email sent to user");
    else toast.success(`Password reset${em?.error ? ` (email failed: ${em.error})` : ""}`);
    void logActivity({ action: "user_reset_password", entity: "user", entityId: target.id,
      description: `Reset password for ${target.email}` });
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Reset Password</DialogTitle>
          <DialogDescription>Set a new password for <b>{target.email}</b>. They will be emailed the new password.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>New password</Label>
            <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="Min. 8 characters" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Reset & Email"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
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
import { WarningConfirmDialog } from "@/components/warning-confirm-dialog";

export const Route = createFileRoute("/_app/users")({ component: UsersPage });

interface ProfileRow {
  id: string; full_name: string; email: string;
  role: "super_admin" | "manager"; custom_role_id: string | null; is_active: boolean;
  last_login: string | null; created_at: string;
}

interface CustomRole { id: string; name: string; label: string; }

function UsersPage() {
  const { user, isSuperAdmin } = useAuth();
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<ProfileRow | null>(null);
  const [delTarget, setDelTarget] = useState<ProfileRow | null>(null);
  const [delRoleTarget, setDelRoleTarget] = useState<CustomRole | null>(null);
  const [newRole, setNewRole] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data, error }, { data: crs }] = await Promise.all([
      supabase.from("user_profiles").select("*").order("created_at"),
      supabase.from("custom_roles" as any).select("*").order("label"),
    ]);
    if (error) toast.error(error.message);
    setRows((data as any) || []);
    setCustomRoles((crs as any) || []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  if (!isSuperAdmin) return <div className="p-8 text-center text-muted-foreground">Super Admin access required.</div>;

  // role value scheme: "super_admin" | "manager" | "custom:<uuid>"
  const updateRole = async (id: string, value: string) => {
    const isCustom = value.startsWith("custom:");
    const payload = isCustom
      ? { role: "manager", custom_role_id: value.slice(7) }
      : { role: value as "super_admin" | "manager", custom_role_id: null };
    const { error } = await supabase.from("user_profiles").update(payload as any).eq("id", id);
    if (error) return toast.error(error.message);
    const u = rows.find((r) => r.id === id);
    void logActivity({ action: "update", entity: "user", entityId: id,
      description: `Changed role of ${u?.email || ""} to ${value}` });
    toast.success("Role updated"); void load();
  };

  const addCustomRole = async () => {
    const label = newRole.trim();
    if (!label) return;
    const name = label.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const { error } = await supabase.from("custom_roles" as any).insert({ name, label } as any);
    if (error) return toast.error(error.message);
    setNewRole(""); toast.success(`Role "${label}" added`); void load();
  };

  const requestDeleteCustomRole = async (cr: CustomRole) => {
    // Block deletion if any portal-access members exist for this role,
    // or any user is assigned to it.
    const [{ count: memberCount }, { count: userCount }] = await Promise.all([
      supabase.from("custom_role_members" as any).select("id", { count: "exact", head: true }).eq("role_id", cr.id),
      supabase.from("user_profiles").select("id", { count: "exact", head: true }).eq("custom_role_id", cr.id),
    ]);
    if ((memberCount || 0) > 0 || (userCount || 0) > 0) {
      return toast.error(
        `Cannot delete "${cr.label}" — ${memberCount || 0} portal-access member(s) and ${userCount || 0} user(s) still use this role. Remove them first.`,
        { duration: 6000 },
      );
    }
    setDelRoleTarget(cr);
  };

  const confirmDeleteCustomRole = async (cr: CustomRole) => {
    const { error } = await supabase.from("custom_roles" as any).delete().eq("id", cr.id);
    if (error) return toast.error(error.message);
    toast.success("Role deleted"); void load();
  };

  const toggleActive = async (id: string, is_active: boolean) => {
    const { error } = await supabase.from("user_profiles").update({ is_active }).eq("id", id);
    if (error) return toast.error(error.message);
    const u = rows.find((r) => r.id === id);
    void logActivity({ action: "user_toggle_active", entity: "user", entityId: id,
      description: `${is_active ? "Activated" : "Deactivated"} user ${u?.email || ""}` });
    toast.success(is_active ? "User activated" : "User deactivated"); void load();
  };

  const requestDeleteUser = (row: ProfileRow) => {
    if (row.id === user?.id) return toast.error("You cannot delete yourself");
    setDelTarget(row);
  };
  const confirmDeleteUser = async (row: ProfileRow) => {
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

      <Card className="mb-4 p-4">
        <div className="mb-2 text-sm font-semibold">Custom Roles</div>
        <div className="flex flex-wrap items-center gap-2">
          {customRoles.map((cr) => (
            <Badge key={cr.id} variant="outline" className="gap-1 pr-1">
              {cr.label}
              <button onClick={() => requestDeleteCustomRole(cr)} className="ml-1 text-destructive hover:bg-destructive/10 rounded px-1">×</button>
            </Badge>
          ))}
          <Input value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder="New role (e.g. Developer)" className="h-8 w-56" />
          <Button size="sm" variant="outline" onClick={addCustomRole}><Plus className="h-3 w-3 mr-1" />Add</Button>
        </div>
      </Card>

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
                    <Select value={r.custom_role_id ? `custom:${r.custom_role_id}` : r.role} onValueChange={(v) => updateRole(r.id, v)} disabled={r.id === user?.id}>
                      <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                        {customRoles.map((cr) => (
                          <SelectItem key={cr.id} value={`custom:${cr.id}`}>{cr.label}</SelectItem>
                        ))}
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
                        onClick={() => requestDeleteUser(r)}
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
      <WarningConfirmDialog
        open={!!delTarget}
        onOpenChange={(o) => !o && setDelTarget(null)}
        title="Delete this user?"
        description={delTarget ? (
          <>This will permanently delete <b>{delTarget.email}</b> and revoke their portal access. This action cannot be undone.</>
        ) : ""}
        confirmLabel="Delete user"
        requireText="DELETE"
        onConfirm={async () => { if (delTarget) { await confirmDeleteUser(delTarget); setDelTarget(null); } }}
      />
      <WarningConfirmDialog
        open={!!delRoleTarget}
        onOpenChange={(o) => !o && setDelRoleTarget(null)}
        title="Delete this role?"
        description={delRoleTarget ? (
          <>This will permanently delete the custom role <b>{delRoleTarget.label}</b>. This action cannot be undone.</>
        ) : ""}
        confirmLabel="Delete role"
        requireText="DELETE"
        onConfirm={async () => { if (delRoleTarget) { await confirmDeleteCustomRole(delRoleTarget); setDelRoleTarget(null); } }}
      />
    </div>
  );
}

function InviteDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [form, setForm] = useState({ full_name: "", email: "", password: "", role: "manager" });
  const [saving, setSaving] = useState(false);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("custom_roles" as any).select("*").order("label");
      setCustomRoles((data as any) || []);
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password || !form.full_name) return toast.error("All fields required");
    const isCustom = form.role.startsWith("custom:");
    const customRoleId = isCustom ? form.role.slice(7) : null;
    const baseRole = isCustom ? "manager" : form.role;
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: { action: "create", email: form.email, password: form.password, full_name: form.full_name, role: baseRole, custom_role_id: customRoleId },
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    if ((data as any)?.error) return toast.error((data as any).error);
    // If custom role, set custom_role_id on the freshly created profile.
    if (isCustom && (data as any)?.user_id) {
      await supabase.from("user_profiles").update({ custom_role_id: customRoleId } as any).eq("id", (data as any).user_id);
    }
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
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                {customRoles.map((cr) => (
                  <SelectItem key={cr.id} value={`custom:${cr.id}`}>{cr.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">Custom roles get Manager-level permissions plus the role label as their title.</p>
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
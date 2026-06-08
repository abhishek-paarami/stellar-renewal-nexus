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
import { Plus, Shield, KeyRound, Trash2, Pencil } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [inviteDefaultRole, setInviteDefaultRole] = useState<string>("manager");
  const [editTarget, setEditTarget] = useState<ProfileRow | null>(null);
  const [resetTarget, setResetTarget] = useState<ProfileRow | null>(null);
  const [delTarget, setDelTarget] = useState<ProfileRow | null>(null);
  const [delRoleTarget, setDelRoleTarget] = useState<CustomRole | null>(null);
  const [blockedRole, setBlockedRole] = useState<{ label: string; count: number } | null>(null);
  const [newRole, setNewRole] = useState("");
  const [tab, setTab] = useState<string>("all");

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

  const addCustomRole = async () => {
    const label = newRole.trim();
    if (!label) return;
    const name = label.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const { error } = await supabase.from("custom_roles" as any).insert({ name, label } as any);
    if (error) return toast.error(error.message);
    setNewRole(""); toast.success(`Role "${label}" added`); void load();
  };

  const requestDeleteCustomRole = async (cr: CustomRole) => {
    // Block deletion only when this role actually has portal users assigned.
    const { count } = await supabase
      .from("user_profiles")
      .select("id", { count: "exact", head: true })
      .eq("custom_role_id", cr.id);
    const totalUsers = count || 0;
    if (totalUsers > 0) {
      setBlockedRole({ label: cr.label, count: totalUsers });
      return;
    }
    setDelRoleTarget(cr);
  };

  const confirmDeleteCustomRole = async (cr: CustomRole) => {
    const { error } = await supabase.from("custom_roles" as any).delete().eq("id", cr.id);
    if (error) return toast.error(error.message);
    toast.success("Role deleted"); void load();
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

  const roleLabel = (r: ProfileRow) => {
    if (r.custom_role_id) {
      return customRoles.find((c) => c.id === r.custom_role_id)?.label || "Custom";
    }
    return r.role === "super_admin" ? "Super Admin" : "Manager";
  };

  const filteredRows = rows.filter((r) => {
    if (tab === "all") return true;
    if (tab === "super_admin") return r.role === "super_admin";
    if (tab === "manager") return r.role === "manager" && !r.custom_role_id;
    if (tab.startsWith("custom:")) return r.custom_role_id === tab.slice(7);
    return true;
  });

  const openInviteForTab = () => {
    if (tab === "super_admin") setInviteDefaultRole("super_admin");
    else if (tab.startsWith("custom:")) setInviteDefaultRole(tab);
    else setInviteDefaultRole("manager");
    setOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="User Management"
        description="Manage roles, invite team members, and control portal access — all in one place."
        actions={
          <Button onClick={openInviteForTab} className="bg-gradient-to-r from-primary to-primary-glow">
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

      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="all">All ({rows.length})</TabsTrigger>
          <TabsTrigger value="super_admin">
            Super Admin ({rows.filter((r) => r.role === "super_admin").length})
          </TabsTrigger>
          <TabsTrigger value="manager">
            Manager ({rows.filter((r) => r.role === "manager" && !r.custom_role_id).length})
          </TabsTrigger>
          {customRoles.map((cr) => (
            <TabsTrigger key={cr.id} value={`custom:${cr.id}`}>
              {cr.label} ({rows.filter((r) => r.custom_role_id === cr.id).length})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

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
              {filteredRows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No users in this role yet.</td></tr>
              )}
              {filteredRows.map((r) => (
                <tr key={r.id} className="hover:bg-accent/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.full_name}</div>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{roleLabel(r)}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={r.is_active ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"}>
                      {r.is_active ? "Active" : "Disabled"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.last_login ? fmtDate(r.last_login) : "Never"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(r.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setEditTarget(r)} title="Edit user">
                        <Pencil className="h-4 w-4" />
                      </Button>
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

      <InviteDialog
        open={open}
        onOpenChange={setOpen}
        defaultRole={inviteDefaultRole}
        onSaved={() => { setOpen(false); void load(); }}
      />
      {editTarget && (
        <EditUserDialog
          target={editTarget}
          customRoles={customRoles}
          isSelf={editTarget.id === user?.id}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); void load(); }}
        />
      )}
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
      <Dialog open={!!blockedRole} onOpenChange={(o) => !o && setBlockedRole(null)}>
        <DialogContent className="max-w-md border-destructive/40">
          <DialogHeader>
            <DialogTitle className="text-destructive">Cannot delete role</DialogTitle>
            <DialogDescription>
              {blockedRole && (
                <>This custom role <b>"{blockedRole.label}"</b> already has <b>{blockedRole.count}</b> user{blockedRole.count === 1 ? "" : "s"} assigned to it. Please remove all users from this role first, then you can delete it.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setBlockedRole(null)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InviteDialog({ open, onOpenChange, onSaved, defaultRole }: { open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void; defaultRole: string }) {
  const [form, setForm] = useState({ full_name: "", email: "", password: "", role: defaultRole });
  const [saving, setSaving] = useState(false);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("custom_roles" as any).select("*").order("label");
      setCustomRoles((data as any) || []);
    })();
  }, []);

  useEffect(() => {
    if (open) setForm((f) => ({ ...f, role: defaultRole }));
  }, [open, defaultRole]);

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

function EditUserDialog({
  target, customRoles, isSelf, onClose, onSaved,
}: {
  target: ProfileRow;
  customRoles: CustomRole[];
  isSelf: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initialRole = target.custom_role_id ? `custom:${target.custom_role_id}` : target.role;
  const [fullName, setFullName] = useState(target.full_name);
  const [role, setRole] = useState<string>(initialRole);
  const [isActive, setIsActive] = useState<boolean>(target.is_active);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const isCustom = role.startsWith("custom:");
    const payload: any = {
      full_name: fullName.trim(),
      role: isCustom ? "manager" : role,
      custom_role_id: isCustom ? role.slice(7) : null,
    };
    if (!isSelf) payload.is_active = isActive;
    const { error } = await supabase.from("user_profiles").update(payload).eq("id", target.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    void logActivity({ action: "update", entity: "user", entityId: target.id,
      description: `Updated user ${target.email}` });
    toast.success("User updated");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Pencil className="h-4 w-4" /> Edit User</DialogTitle>
          <DialogDescription>Update profile, role, and access for <b>{target.email}</b>.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={target.email} disabled />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole} disabled={isSelf}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                {customRoles.map((cr) => (
                  <SelectItem key={cr.id} value={`custom:${cr.id}`}>{cr.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isSelf && <p className="text-[11px] text-muted-foreground">You cannot change your own role.</p>}
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Account Active</div>
              <div className="text-[11px] text-muted-foreground">Disabled users cannot sign in.</div>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} disabled={isSelf} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
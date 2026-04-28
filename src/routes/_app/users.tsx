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
import { Plus, Shield, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { fmtDate } from "@/lib/format";

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
    toast.success("Role updated"); void load();
  };

  const toggleActive = async (id: string, is_active: boolean) => {
    const { error } = await supabase.from("user_profiles").update({ is_active }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(is_active ? "User activated" : "User deactivated"); void load();
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
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <InviteDialog open={open} onOpenChange={setOpen} onSaved={() => { setOpen(false); void load(); }} />
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
      body: { email: form.email, password: form.password, full_name: form.full_name, role: form.role },
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    if ((data as any)?.error) return toast.error((data as any).error);
    toast.success("User created");
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
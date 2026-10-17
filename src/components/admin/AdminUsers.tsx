import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Ban, ShieldCheck, ShieldMinus, Trash2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function AdminUsers({ adminId }: { adminId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["admin-user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      return data;
    },
  });

  const logAction = async (action: string, targetType: string, targetId: string) => {
    await supabase.from("activity_logs").insert({ admin_id: adminId, action, target_type: targetType, target_id: targetId });
  };

  const banUser = useMutation({
    mutationFn: async ({ userId, ban }: { userId: string; ban: boolean }) => {
      const { error } = await supabase.from("profiles").update({ banned_at: ban ? new Date().toISOString() : null }).eq("user_id", userId);
      if (error) throw error;
      await logAction(ban ? "ban_user" : "unban_user", "user", userId);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); toast({ title: "User updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleAdmin = useMutation({
    mutationFn: async ({ userId, promote }: { userId: string; promote: boolean }) => {
      if (promote) {
        const { error } = await supabase.from("user_roles").upsert({ user_id: userId, role: "admin" as any }, { onConflict: "user_id,role" });
        if (error) {
          // If upsert fails, try update
          const { error: updateErr } = await supabase.from("user_roles").update({ role: "admin" as any }).eq("user_id", userId);
          if (updateErr) throw updateErr;
        }
      } else {
        const { error } = await supabase.from("user_roles").update({ role: "user" as any }).eq("user_id", userId);
        if (error) throw error;
      }
      await logAction(promote ? "promote_admin" : "demote_admin", "user", userId);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-user-roles"] }); toast({ title: "Role updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("profiles").delete().eq("user_id", userId);
      if (error) throw error;
      await logAction("delete_user", "user", userId);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); toast({ title: "User deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const getUserRole = (userId: string) => roles.find((r: any) => r.user_id === userId)?.role ?? "user";

  const filtered = users.filter((u: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (u.full_name || "").toLowerCase().includes(s) || (u.location || "").toLowerCase().includes(s) || u.user_id.includes(s);
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>
      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((u: any) => {
              const role = getUserRole(u.user_id);
              const isBanned = !!u.banned_at;
              const isSelf = u.user_id === adminId;
              return (
                <TableRow key={u.id} className={isBanned ? "opacity-60" : ""}>
                  <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                  <TableCell>{u.location || "—"}</TableCell>
                  <TableCell><Badge variant={role === "admin" ? "default" : "secondary"} className="capitalize">{role}</Badge></TableCell>
                  <TableCell>{Number(u.reputation_score || 0).toFixed(1)}</TableCell>
                  <TableCell>
                    {isBanned ? <Badge variant="destructive">Banned</Badge> : <Badge variant="outline" className="text-green-600 border-green-600">Active</Badge>}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{format(new Date(u.created_at), "MMM d, yyyy")}</TableCell>
                  <TableCell className="text-right space-x-1">
                    {!isSelf && (
                      <>
                        <Button variant="ghost" size="sm" className={isBanned ? "text-green-600" : "text-destructive"} onClick={() => banUser.mutate({ userId: u.user_id, ban: !isBanned })} disabled={banUser.isPending} title={isBanned ? "Unban" : "Ban"}>
                          <Ban className="h-4 w-4" />
                        </Button>
                        {role !== "admin" ? (
                          <Button variant="ghost" size="sm" className="text-primary" onClick={() => toggleAdmin.mutate({ userId: u.user_id, promote: true })} disabled={toggleAdmin.isPending} title="Promote to Admin">
                            <ShieldCheck className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" className="text-warning" onClick={() => toggleAdmin.mutate({ userId: u.user_id, promote: false })} disabled={toggleAdmin.isPending} title="Demote to User">
                            <ShieldMinus className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { if (confirm("Delete this user permanently?")) deleteUser.mutate(u.user_id); }} disabled={deleteUser.isPending} title="Delete User">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No users found</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

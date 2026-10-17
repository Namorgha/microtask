import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Trash2, Flag, FlagOff, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { calculateDealConfidence } from "@/lib/dealConfidence";
import { ConfidenceBadge } from "@/components/shared/ConfidenceBadge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ConfidenceCard } from "@/components/shared/ConfidenceCard";

export default function AdminTasks({ adminId }: { adminId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["admin-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, poster:profiles!tasks_poster_id_profiles_fkey(full_name, avatar_url, bio, location, reputation_score, total_reviews_count, completed_tasks_count, banned_at, created_at)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const logAction = async (action: string, targetId: string) => {
    await supabase.from("activity_logs").insert({ admin_id: adminId, action, target_type: "task", target_id: targetId });
  };

  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);
      if (error) throw error;
      await logAction("delete_task", taskId);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-tasks"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] }); toast({ title: "Task deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleFlag = useMutation({
    mutationFn: async ({ taskId, flag }: { taskId: string; flag: boolean }) => {
      const { error } = await supabase.from("tasks").update({ flagged: flag, flag_reason: flag ? "Flagged by admin" : null } as any).eq("id", taskId);
      if (error) throw error;
      await logAction(flag ? "flag_task" : "unflag_task", taskId);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-tasks"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] }); toast({ title: "Task updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = tasks.filter((t: any) => {
    if (statusFilter !== "all" && statusFilter === "flagged" && !t.flagged) return false;
    if (statusFilter !== "all" && statusFilter !== "flagged" && t.status !== statusFilter) return false;
    if (!search) return true;
    return t.title.toLowerCase().includes(search.toLowerCase());
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search tasks..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="flagged">⚠ Flagged</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead>Posted by</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((t: any) => {
              const confidence = calculateDealConfidence({ task: t, poster: t.poster || null });
              return (
              <TableRow key={t.id} className={t.flagged ? "bg-destructive/5" : ""}>
                <TableCell className="font-medium max-w-[200px] truncate">
                  {t.flagged && <Flag className="h-3.5 w-3.5 inline mr-1 text-destructive" />}
                  {t.title}
                </TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{t.category}</Badge></TableCell>
                <TableCell>${Number(t.price)}</TableCell>
                <TableCell><Badge className="capitalize">{t.status.replace("_", " ")}</Badge></TableCell>
                <TableCell>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button">
                        <ConfidenceBadge result={confidence} size="sm" showScore withPopover={false} />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="start">
                      <ConfidenceCard result={confidence} compact admin showSuggestions={false} />
                    </PopoverContent>
                  </Popover>
                </TableCell>
                <TableCell>{(t.poster as any)?.full_name || "—"}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{format(new Date(t.created_at), "MMM d, yyyy")}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="sm" className={t.flagged ? "text-primary" : "text-warning"} onClick={() => toggleFlag.mutate({ taskId: t.id, flag: !t.flagged })} disabled={toggleFlag.isPending} title={t.flagged ? "Unflag" : "Flag"}>
                    {t.flagged ? <FlagOff className="h-4 w-4" /> : <Flag className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { if (confirm("Delete this task?")) deleteTask.mutate(t.id); }} disabled={deleteTask.isPending}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
              );
            })}
            {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No tasks found</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

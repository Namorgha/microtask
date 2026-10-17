import { Navigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Shield, Users, ListTodo, BarChart3, Settings, ScrollText, PieChart, Flag, DollarSign, ShieldCheck, BadgeCheck } from "lucide-react";
import AdminDashboard from "@/components/admin/AdminDashboard";
import AdminUsers from "@/components/admin/AdminUsers";
import AdminTasks from "@/components/admin/AdminTasks";
import AdminSettings from "@/components/admin/AdminSettings";
import AdminLogs from "@/components/admin/AdminLogs";
import AdminAnalytics from "@/components/admin/AdminAnalytics";
import AdminReports from "@/components/admin/AdminReports";
import AdminPayments from "@/components/admin/AdminPayments";
import AdminQualityEngine from "@/components/admin/AdminQualityEngine";
import AdminVerifications from "@/components/admin/AdminVerifications";

export default function Admin() {
  const { user } = useAuth();
  const [tab, setTab] = useState("dashboard");

  const { data: isAdmin, isLoading: checkingRole } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id).eq("role", "admin").maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });

  if (!user) return <Navigate to="/auth" replace />;
  if (checkingRole) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!isAdmin) return <div className="container py-16 text-center"><Shield className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" /><p className="text-muted-foreground">Access denied. Admin only.</p></div>;

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="font-display text-2xl font-bold">Admin Panel</h1>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="dashboard" className="gap-1.5"><BarChart3 className="h-4 w-4" /> Dashboard</TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5"><Users className="h-4 w-4" /> Users</TabsTrigger>
          <TabsTrigger value="tasks" className="gap-1.5"><ListTodo className="h-4 w-4" /> Tasks</TabsTrigger>
          <TabsTrigger value="payments" className="gap-1.5"><DollarSign className="h-4 w-4" /> Payments</TabsTrigger>
          <TabsTrigger value="reports" className="gap-1.5"><Flag className="h-4 w-4" /> Reports</TabsTrigger>
          <TabsTrigger value="verifications" className="gap-1.5"><BadgeCheck className="h-4 w-4" /> Verifications</TabsTrigger>
          <TabsTrigger value="quality" className="gap-1.5"><ShieldCheck className="h-4 w-4" /> Quality</TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5"><PieChart className="h-4 w-4" /> Analytics</TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5"><Settings className="h-4 w-4" /> Settings</TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5"><ScrollText className="h-4 w-4" /> Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4"><AdminDashboard onNavigate={setTab} /></TabsContent>
        <TabsContent value="users" className="mt-4"><AdminUsers adminId={user.id} /></TabsContent>
        <TabsContent value="tasks" className="mt-4"><AdminTasks adminId={user.id} /></TabsContent>
        <TabsContent value="payments" className="mt-4"><AdminPayments /></TabsContent>
        <TabsContent value="reports" className="mt-4"><AdminReports adminId={user.id} /></TabsContent>
        <TabsContent value="verifications" className="mt-4"><AdminVerifications adminId={user.id} /></TabsContent>
        <TabsContent value="quality" className="mt-4"><AdminQualityEngine /></TabsContent>
        <TabsContent value="analytics" className="mt-4"><AdminAnalytics /></TabsContent>
        <TabsContent value="settings" className="mt-4"><AdminSettings adminId={user.id} /></TabsContent>
        <TabsContent value="logs" className="mt-4"><AdminLogs /></TabsContent>
      </Tabs>
    </div>
  );
}

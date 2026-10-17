import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { format, subDays } from "date-fns";

const COLORS = ["hsl(168, 80%, 36%)", "hsl(35, 95%, 55%)", "hsl(220, 70%, 55%)", "hsl(0, 72%, 51%)", "hsl(280, 60%, 50%)", "hsl(142, 70%, 45%)", "hsl(200, 80%, 50%)", "hsl(320, 60%, 50%)"];

export default function AdminAnalytics() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: async () => {
      const [tasksRes, categoriesRes] = await Promise.all([
        supabase.from("tasks").select("created_at, status, category").order("created_at", { ascending: true }),
        supabase.from("tasks").select("category"),
      ]);

      // Tasks per day (last 30 days)
      const thirtyDaysAgo = subDays(new Date(), 30);
      const dailyCounts: Record<string, number> = {};
      (tasksRes.data ?? []).forEach((t: any) => {
        const d = new Date(t.created_at);
        if (d >= thirtyDaysAgo) {
          const key = format(d, "MMM d");
          dailyCounts[key] = (dailyCounts[key] || 0) + 1;
        }
      });
      const dailyData = Object.entries(dailyCounts).map(([date, count]) => ({ date, tasks: count }));

      // Category breakdown
      const catCounts: Record<string, number> = {};
      (categoriesRes.data ?? []).forEach((t: any) => {
        catCounts[t.category] = (catCounts[t.category] || 0) + 1;
      });
      const categoryData = Object.entries(catCounts).map(([name, value]) => ({ name, value }));

      // Status breakdown
      const statusCounts: Record<string, number> = {};
      (tasksRes.data ?? []).forEach((t: any) => {
        statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
      });
      const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name: name.replace("_", " "), value }));

      return { dailyData, categoryData, statusData };
    },
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="text-lg">Tasks Created (Last 30 Days)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data?.dailyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" className="text-xs" tick={{ fill: "hsl(220, 10%, 46%)" }} />
              <YAxis className="text-xs" tick={{ fill: "hsl(220, 10%, 46%)" }} />
              <Tooltip contentStyle={{ borderRadius: "0.5rem", border: "1px solid hsl(220, 15%, 90%)" }} />
              <Bar dataKey="tasks" fill="hsl(168, 80%, 36%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Tasks by Category</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={data?.categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={12}>
                {data?.categoryData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Task Status Distribution</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={data?.statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={12}>
                {data?.statusData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, DollarSign } from "lucide-react";
import { format } from "date-fns";

export default function AdminPayments() {
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["admin-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, task:tasks(title)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const totalRevenue = payments.filter((p: any) => p.status === "completed").reduce((sum: number, p: any) => sum + Number(p.platform_fee), 0);
  console.log(payments);
  console.log(totalRevenue);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <DollarSign className="h-8 w-8 text-primary" />
          <div>
            <p className="text-sm text-muted-foreground">Platform Revenue (Fees)</p>
            <p className="text-2xl font-bold">${totalRevenue.toFixed(2)}</p>
          </div>
          <Badge variant="secondary" className="ml-auto">{payments.length} transactions</Badge>
        </CardContent>
      </Card>

      {payments.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <DollarSign className="h-10 w-10 mx-auto opacity-40 mb-2" />
          <p>No payments yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {payments.map((p: any) => (
            <Card key={p.id}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{(p.task as any)?.title || "Unknown Task"}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(p.created_at), "MMM d, yyyy h:mm a")}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold">${Number(p.amount).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Fee: ${Number(p.platform_fee).toFixed(2)}</p>
                </div>
                <Badge variant={p.status === "completed" ? "default" : "secondary"} className="capitalize">{p.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

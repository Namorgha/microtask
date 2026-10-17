import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { XCircle } from "lucide-react";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export default function PaymentCancelled() {
  const [searchParams] = useSearchParams();
  const taskId = searchParams.get("task_id");
  const { user } = useAuth();

  useEffect(() => {
    if (!taskId || !user) return;
    // Best-effort cleanup of stale pending payment via edge function (RLS-safe)
    supabase.functions.invoke("cancel-task-payment", { body: { task_id: taskId } }).catch(() => {});
  }, [taskId, user]);

  return (
    <div className="container max-w-md py-16">
      <Card>
        <CardContent className="p-8 text-center">
          <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h1 className="font-display text-2xl font-bold mb-2">Payment Cancelled</h1>
          <p className="text-muted-foreground mb-6">No charges were made. You can try again anytime.</p>
          <div className="flex gap-3 justify-center">
            {taskId && <Link to={`/tasks/${taskId}`}><Button>Back to Task</Button></Link>}
            <Link to="/my-tasks"><Button variant="outline">My Tasks</Button></Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

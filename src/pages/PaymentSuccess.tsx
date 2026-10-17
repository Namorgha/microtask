import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const [verifying, setVerifying] = useState(true);
  const [success, setSuccess] = useState(false);
  const sessionId = searchParams.get("session_id");
  const taskId = searchParams.get("task_id");

  useEffect(() => {
    if (!sessionId || !taskId) { setVerifying(false); return; }
    
    const verify = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("verify-task-payment", {
          body: { session_id: sessionId, task_id: taskId },
        });
        if (error) throw error;
        setSuccess(data?.success === true);
      } catch {
        setSuccess(false);
      } finally {
        setVerifying(false);
      }
    };
    verify();
  }, [sessionId, taskId]);

  return (
    <div className="container max-w-md py-16">
      <Card>
        <CardContent className="p-8 text-center">
          {verifying ? (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Verifying payment...</p>
            </>
          ) : success ? (
            <>
              <CheckCircle2 className="h-16 w-16 text-primary mx-auto mb-4" />
              <h1 className="font-display text-2xl font-bold mb-2">Payment secured</h1>
              <p className="text-muted-foreground mb-4">
                Your funds are safely held in escrow. The doer can now start work, and payment will be released to them once you confirm the task is complete.
              </p>
              <div className="flex items-start gap-2 text-left text-xs text-muted-foreground bg-muted/40 border border-border rounded-lg p-3 mb-6">
                <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>You stay in control — payment only moves once you release it after the work is done.</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Link to={`/tasks/${taskId}`}><Button>View Task</Button></Link>
                <Link to="/my-tasks"><Button variant="outline">My Tasks</Button></Link>
              </div>
            </>
          ) : (
            <>
              <h1 className="font-display text-2xl font-bold mb-2">Payment Verification Failed</h1>
              <p className="text-muted-foreground mb-6">Please contact support if you were charged.</p>
              <Link to="/my-tasks"><Button>Back to My Tasks</Button></Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

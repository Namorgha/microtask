import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Mail, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Navigate } from "react-router-dom";

export default function VerifyEmail() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [resending, setResending] = useState(false);

  if (!user) return <Navigate to="/auth" replace />;
  if (user.email_confirmed_at) return <Navigate to="/tasks" replace />;

  const handleResend = async () => {
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: user.email!,
      });
      if (error) throw error;
      toast({ title: "Verification email sent!", description: "Check your inbox." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-2">
            <Mail className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="font-display text-2xl">Verify your email</CardTitle>
          <CardDescription>
            We sent a verification link to <strong>{user.email}</strong>. Please check your inbox and click the link to activate your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You need to verify your email before you can post or accept tasks.
          </p>
          <Button variant="outline" className="gap-2" onClick={handleResend} disabled={resending}>
            <RefreshCw className={`h-4 w-4 ${resending ? "animate-spin" : ""}`} />
            Resend verification email
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

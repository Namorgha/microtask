import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldX } from "lucide-react";
import { useEmailVerificationRequired } from "@/hooks/useEmailVerificationRequired";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireEmailVerified?: boolean;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireEmailVerified = false, requireAdmin = false }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const emailVerifRequired = useEmailVerificationRequired();

  const { data: isAdmin, isLoading: checkingAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
    enabled: !!user && requireAdmin,
  });

  // Check if user is banned
  const { data: profile, isLoading: checkingProfile } = useQuery({
    queryKey: ["profile-ban-check", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("banned_at")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  if (loading || (requireAdmin && checkingAdmin) || checkingProfile) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
  }

  // Banned user check
  if (profile?.banned_at) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <ShieldX className="h-16 w-16 text-destructive" />
        <h2 className="font-display text-xl font-bold">Account Suspended</h2>
        <p className="text-muted-foreground text-center max-w-sm">Your account has been suspended. Please contact support if you believe this is an error.</p>
      </div>
    );
  }

  if (requireEmailVerified && emailVerifRequired && !user.email_confirmed_at) {
    return <Navigate to="/verify-email" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

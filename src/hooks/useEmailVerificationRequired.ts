import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useEmailVerificationRequired() {
  const { data: required = true } = useQuery({
    queryKey: ["app-settings", "require_email_verification"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "require_email_verification")
        .single();
      if (error) return true; // default to requiring verification
      return data?.value === "true" || data?.value === true;
    },
    staleTime: 60000,
  });
  return required;
}

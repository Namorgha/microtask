import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Not authenticated" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    if (!userData.user) return json({ error: "Not authenticated" }, 401);

    let parsed: any;
    try { parsed = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    const { task_id } = parsed || {};
    if (!task_id) return json({ error: "task_id is required" }, 400);

    // Only delete the caller's own pending rows for this task
    await supabaseClient
      .from("payments")
      .delete()
      .eq("task_id", task_id)
      .eq("payer_id", userData.user.id)
      .eq("status", "pending");

    return json({ success: true });
  } catch (err) {
    console.error("[cancel-task-payment]", err);
    return json({ error: (err as Error).message }, 500);
  }
});

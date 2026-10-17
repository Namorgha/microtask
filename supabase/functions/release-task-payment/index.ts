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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Not authenticated" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Not authenticated" }, 401);

    let parsed: any;
    try { parsed = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    const { task_id } = parsed || {};
    if (!task_id) return json({ error: "task_id is required" }, 400);

    // Get task
    const { data: task, error: taskError } = await supabaseClient
      .from("tasks").select("*").eq("id", task_id).maybeSingle();
    if (taskError) throw taskError;
    if (!task) return json({ error: "Task not found" }, 404);
    if (task.poster_id !== userData.user.id) return json({ error: "Only the poster can release payment" }, 403);
    if (task.status !== "completed") return json({ error: "Task must be completed before releasing payment" }, 409);

    // Require a valid escrow payment row before releasing
    const { data: escrowPayment } = await supabaseClient
      .from("payments")
      .select("id")
      .eq("task_id", task_id)
      .eq("status", "escrow")
      .maybeSingle();
    if (!escrowPayment) return json({ error: "No escrow payment found for this task" }, 409);

    // Atomic: only release if still in escrow
    const { data: released } = await supabaseClient
      .from("payments")
      .update({ status: "released", updated_at: new Date().toISOString() })
      .eq("id", escrowPayment.id)
      .eq("status", "escrow")
      .select("id")
      .maybeSingle();
    if (!released) return json({ error: "Payment was already released" }, 409);

    // Atomic: only mark paid if still completed
    await supabaseClient
      .from("tasks")
      .update({ status: "paid" })
      .eq("id", task_id)
      .eq("status", "completed");

    // Notify both parties
    const notifications = [
      {
        user_id: task.poster_id,
        title: "Payment Released",
        message: `Payment for "${task.title}" has been released.`,
        type: "payment",
        data: { task_id },
      },
      {
        user_id: task.doer_id,
        title: "Payment Received!",
        message: `You've been paid for "${task.title}"!`,
        type: "payment",
        data: { task_id },
      },
    ];
    await supabaseClient.from("notifications").insert(notifications);

    // Recompute doer's completed tasks count from source of truth
    if (task.doer_id) {
      await supabaseClient.rpc("increment_completed_tasks", { _user_id: task.doer_id });
    }

    return json({ success: true });
  } catch (error) {
    console.error("[release-task-payment]", error);
    return json({ error: (error as Error).message }, 500);
  }
});

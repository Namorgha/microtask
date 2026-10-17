import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
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
    const userId = userData.user.id;

    let parsed: any;
    try { parsed = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    const { session_id, task_id } = parsed || {};
    if (!session_id || !task_id) return json({ error: "session_id and task_id required" }, 400);

    // Caller must be the task poster
    const { data: task } = await supabaseClient
      .from("tasks").select("*").eq("id", task_id).maybeSingle();
    if (!task) return json({ error: "Task not found" }, 404);
    if (task.poster_id !== userId) return json({ error: "Not allowed" }, 403);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const session = await stripe.checkout.sessions.retrieve(session_id);

    // Bind session metadata to task and caller
    const meta = session.metadata || {};
    if (meta.task_id !== task_id) return json({ error: "Session does not match task" }, 403);
    if (meta.payer_id && meta.payer_id !== userId) return json({ error: "Session does not belong to caller" }, 403);

    if (session.payment_status !== "paid") {
      return json({ success: false, status: session.payment_status });
    }

    // Update payment record to escrow (only if a matching pending row exists)
    await supabaseClient
      .from("payments")
      .update({ status: "escrow", stripe_payment_intent_id: (session.payment_intent as string) ?? session.id, updated_at: new Date().toISOString() })
      .eq("task_id", task_id)
      .eq("status", "pending");

    // Update task status to funded (only from accepted)
    await supabaseClient
      .from("tasks")
      .update({ status: "funded" })
      .eq("id", task_id)
      .eq("status", "accepted");

    {
      const notifications = [
        {
          user_id: task.poster_id,
          title: "Escrow Funded",
          message: `Payment for "${task.title}" is held in escrow.`,
          type: "payment",
          data: { task_id },
        },
        {
          user_id: task.doer_id,
          title: "Task Funded!",
          message: `"${task.title}" has been funded. You can start working!`,
          type: "payment",
          data: { task_id },
        },
      ];
      await supabaseClient.from("notifications").insert(notifications);
    }

    return json({ success: true });
  } catch (error) {
    console.error("[verify-task-payment]", error);
    return json({ error: (error as Error).message }, 500);
  }
});

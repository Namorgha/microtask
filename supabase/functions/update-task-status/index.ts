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

// Allowed transitions: { from -> { to -> "poster" | "doer" } }
const TRANSITIONS: Record<string, Record<string, "poster" | "doer">> = {
  funded: { in_progress: "doer" },
  in_progress: { completed: "doer" },
};

const STATUS_LABELS: Record<string, string> = {
  in_progress: "In Progress",
  completed: "Completed",
};

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
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Not authenticated" }, 401);
    const userId = userData.user.id;

    let body: any;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    const { task_id, new_status } = body || {};
    if (!task_id || !new_status) return json({ error: "task_id and new_status required" }, 400);

    // Banned check
    const { data: profile } = await supabaseClient
      .from("profiles").select("banned_at").eq("user_id", userId).maybeSingle();
    if (profile?.banned_at) return json({ error: "Account is suspended" }, 403);

    const { data: task, error: tErr } = await supabaseClient
      .from("tasks").select("*").eq("id", task_id).maybeSingle();
    if (tErr) throw tErr;
    if (!task) return json({ error: "Task not found" }, 404);

    const allowed = TRANSITIONS[task.status]?.[new_status];
    if (!allowed) return json({ error: `Cannot transition from ${task.status} to ${new_status}` }, 409);

    const expectedActor = allowed === "poster" ? task.poster_id : task.doer_id;
    if (expectedActor !== userId) return json({ error: "Not allowed" }, 403);

    // Atomic transition
    const { data: updated, error: updErr } = await supabaseClient
      .from("tasks")
      .update({ status: new_status })
      .eq("id", task_id)
      .eq("status", task.status)
      .select("id")
      .maybeSingle();
    if (updErr) throw updErr;
    if (!updated) return json({ error: "Task status changed, please refresh" }, 409);

    // Notify counterpart
    const otherUserId = userId === task.poster_id ? task.doer_id : task.poster_id;
    if (otherUserId) {
      const label = STATUS_LABELS[new_status] ?? new_status;
      await supabaseClient.from("notifications").insert({
        user_id: otherUserId,
        title: `Task ${label}`,
        message: `"${task.title}" is now ${label.toLowerCase()}.`,
        type: new_status === "completed" ? "task_completed" : "task_accepted",
        data: { task_id },
      });
    }

    return json({ success: true });
  } catch (err) {
    console.error("[update-task-status]", err);
    return json({ error: (err as Error).message ?? "Unknown error" }, 500);
  }
});

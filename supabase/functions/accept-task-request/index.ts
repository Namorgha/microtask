import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Not authenticated");
    const userId = userData.user.id;

    const { application_id, action } = await req.json();
    if (!application_id || !action) throw new Error("application_id and action required");
    if (!["accept", "reject"].includes(action)) throw new Error("action must be 'accept' or 'reject'");

    // Get the application
    const { data: application, error: appError } = await supabaseClient
      .from("task_applications")
      .select("*")
      .eq("id", application_id)
      .maybeSingle();
    if (appError) throw appError;
    if (!application) return clientError("Application not found", 404);
    if (application.status !== "pending") return clientError("This request has already been handled", 409);

    // Get the task
    const { data: task, error: taskError } = await supabaseClient
      .from("tasks")
      .select("*")
      .eq("id", application.task_id)
      .maybeSingle();
    if (taskError) throw taskError;
    if (!task) return clientError("Task not found", 404);
    if (task.poster_id !== userId) return clientError("Only the task poster can accept/reject requests", 403);
    if (task.status !== "open") return clientError("Task is no longer open", 409);

    if (action === "reject") {
      // Atomic: only reject if still pending
      const { data: rejected } = await supabaseClient
        .from("task_applications")
        .update({ status: "rejected" })
        .eq("id", application_id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();
      if (!rejected) return clientError("This request has already been handled", 409);

      await supabaseClient.from("notifications").insert({
        user_id: application.doer_id,
        title: "Request Rejected",
        message: `Your request for "${task.title}" was not accepted.`,
        type: "task_application",
        data: { task_id: task.id },
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Accept: update this application, reject all others, assign doer
    // ATOMIC: only update task if still open and unassigned (prevents race condition)
    const { data: updatedTask, error: taskUpdErr } = await supabaseClient
      .from("tasks")
      .update({ status: "accepted", doer_id: application.doer_id })
      .eq("id", task.id)
      .eq("status", "open")
      .is("doer_id", null)
      .select("id")
      .maybeSingle();
    if (taskUpdErr) throw taskUpdErr;
    if (!updatedTask) return clientError("Task was already accepted by someone else", 409);

    // Mark this application accepted (atomic on pending)
    await supabaseClient
      .from("task_applications")
      .update({ status: "accepted" })
      .eq("id", application_id)
      .eq("status", "pending");

    // Reject all other pending applications
    const { data: otherApps } = await supabaseClient
      .from("task_applications")
      .update({ status: "rejected" })
      .eq("task_id", task.id)
      .neq("id", application_id)
      .eq("status", "pending")
      .select("doer_id");

    // Notify accepted user
    await supabaseClient.from("notifications").insert({
      user_id: application.doer_id,
      title: "Request Accepted!",
      message: `Your request for "${task.title}" has been accepted!`,
      type: "task_accepted",
      data: { task_id: task.id },
    });

    // Notify rejected users
    if (otherApps && otherApps.length > 0) {
      const rejectionNotifications = otherApps.map((app: any) => ({
        user_id: app.doer_id,
        title: "Request Not Selected",
        message: `Another person was selected for "${task.title}".`,
        type: "task_application",
        data: { task_id: task.id },
      }));
      await supabaseClient.from("notifications").insert(rejectionNotifications);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("accept-task-request error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

function clientError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

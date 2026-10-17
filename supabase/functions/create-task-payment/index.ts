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
    const user = userData.user;

    let parsed: any;
    try { parsed = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    const { task_id } = parsed || {};
    if (!task_id) return json({ error: "task_id is required" }, 400);

    console.log("[create-task-payment] user:", user.id, "task:", task_id);

    // Fetch task
    const { data: task, error: taskError } = await supabaseClient
      .from("tasks").select("*").eq("id", task_id).maybeSingle();
    if (taskError) throw taskError;
    if (!task) return json({ error: "Task not found" }, 404);
    if (task.poster_id !== user.id) return json({ error: "Only the poster can initiate payment" }, 403);
    if (task.status !== "accepted") return json({ error: "Task must be accepted before funding" }, 409);
    if (!task.doer_id) return json({ error: "Task has no assigned doer" }, 409);

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "Payments not configured" }, 500);

    // Get platform fee
    const { data: feeSetting } = await supabaseClient
      .from("app_settings")
      .select("value")
      .eq("key", "platform_fee_percent")
      .single();
    const feePercent = feeSetting ? Number(feeSetting.value) : 8;
    const platformFee = Math.round(Number(task.price) * feePercent) / 100;
    const totalAmount = Number(task.price);

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    // Idempotency: reuse existing valid pending Checkout session if any
    const { data: existingPending } = await supabaseClient
      .from("payments")
      .select("id, stripe_payment_intent_id")
      .eq("task_id", task_id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingPending?.stripe_payment_intent_id?.startsWith("cs_")) {
      try {
        const existing = await stripe.checkout.sessions.retrieve(existingPending.stripe_payment_intent_id);
        if (existing.status === "open" && existing.url) {
          console.log("[create-task-payment] reusing pending session", existing.id);
          return json({ url: existing.url }, 200);
        }
      } catch (e) {
        console.warn("[create-task-payment] failed to retrieve existing session, creating new", e);
      }
    }

    // Check for existing Stripe customer
    const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) customerId = customers.data[0].id;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email!,
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: `Escrow: ${task.title}` },
          unit_amount: Math.round(totalAmount * 100),
        },
        quantity: 1,
      }],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/payment-success?session_id={CHECKOUT_SESSION_ID}&task_id=${task_id}`,
      cancel_url: `${req.headers.get("origin")}/payment-cancelled?task_id=${task_id}`,
      metadata: { task_id, payer_id: user.id, payee_id: task.doer_id, platform_fee: platformFee.toString() },
    });

    // Upsert single pending row per task (replace stale one)
    if (existingPending?.id) {
      await supabaseClient
        .from("payments")
        .update({
          payer_id: user.id,
          payee_id: task.doer_id,
          amount: totalAmount,
          platform_fee: platformFee,
          stripe_payment_intent_id: session.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingPending.id);
    } else {
      await supabaseClient.from("payments").insert({
        task_id,
        payer_id: user.id,
        payee_id: task.doer_id,
        amount: totalAmount,
        platform_fee: platformFee,
        status: "pending",
        stripe_payment_intent_id: session.id,
      });
    }

    console.log("[create-task-payment] checkout session created:", session.id);
    return json({ url: session.url }, 200);
  } catch (error) {
    console.error("[create-task-payment] error:", (error as any)?.message, error);
    return json({ error: (error as any)?.message || "Unknown error" }, 500);
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return json(500, { error: "Server is not configured" });
    }

    const authorization = req.headers.get("Authorization");
    if (!authorization) return json(401, { error: "Not authenticated" });

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return json(401, { error: "Session expired. Please sign in again." });

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json(400, { error: "Invalid JSON body" });
    }

    const jobId = typeof body.jobId === "string" ? body.jobId : null;
    const returnUrl = typeof body.returnUrl === "string" ? body.returnUrl : undefined;
    const environment = body.environment === "live" ? "live" : "sandbox";

    if (!jobId) return json(400, { error: "Missing jobId" });

    // Re-derive the amount server-side from the DB to prevent client tampering.
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: job, error: jobErr } = await admin
      .from("jobs")
      .select("id, owner_id, title, price, total_amount, status")
      .eq("id", jobId)
      .maybeSingle();

    if (jobErr) return json(500, { error: "Could not load job" });
    if (!job) return json(404, { error: "Job not found" });

    // Only the job owner may pay for their own job.
    if (job.owner_id !== user.id) {
      return json(403, { error: "You are not the owner of this job" });
    }

    // Don't allow re-charging an already-active or completed job.
    if (job.status && !["pending_payment", "draft"].includes(job.status)) {
      return json(409, { error: "This job has already been activated" });
    }

    // total_amount is the buyer-facing amount (price + 10% platform fee), in dollars.
    const price = Number(job.price ?? 0);
    const totalAmount = Number(
      job.total_amount ?? Math.round((price + price * 0.1) * 100) / 100,
    );
    const amountInCents = Math.round(totalAmount * 100);
    if (!Number.isFinite(amountInCents) || amountInCents < 50) {
      return json(400, { error: "Invalid job amount" });
    }

    const env = environment as StripeEnv;
    const stripe = createStripeClient(env);

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: job.title ? `Job: ${job.title}` : "Cleaning Job" },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      ui_mode: "embedded_page",
      return_url: returnUrl || `${req.headers.get("origin")}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      ...(user.email && { customer_email: user.email }),
      metadata: {
        jobId,
        userId: user.id,
        purpose: "job_payment",
      },
      payment_intent_data: {
        metadata: {
          jobId,
          userId: user.id,
          purpose: "job_payment",
        },
      },
    });

    if (!session.client_secret) {
      console.error("[create-job-checkout] Stripe returned no client_secret", session.id);
      return json(502, { error: "Stripe did not return a client secret" });
    }

    return json(200, { clientSecret: session.client_secret });
  } catch (error) {
    console.error("[create-job-checkout] error:", error);
    return json(500, { error: (error as Error).message || "Internal error" });
  }
});

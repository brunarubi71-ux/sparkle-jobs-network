// Verify a Stripe checkout session and return its real payment status.
// Frontend calls this after the user is redirected back from Stripe Checkout
// so we never display "success" based purely on a URL parameter.
//
// Required env vars (auto-set by Supabase): SUPABASE_URL, SUPABASE_ANON_KEY
// Required env var (set in Lovable Cloud secrets): STRIPE_SECRET_KEY
import { createStripeClient } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  let sessionId: string | undefined;
  try {
    const body = await req.json();
    sessionId = body?.sessionId;
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  if (!sessionId || typeof sessionId !== "string" || !sessionId.startsWith("cs_")) {
    return json(400, { error: "Invalid sessionId" });
  }

  try {
    const stripe = createStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    return json(200, {
      paid:
        session.payment_status === "paid" ||
        session.payment_status === "no_payment_required",
      payment_status: session.payment_status,
      amount_total: session.amount_total,
      currency: session.currency,
      mode: session.mode,
      customer_email: session.customer_details?.email ?? null,
      metadata: session.metadata ?? {},
    });
  } catch (err) {
    return json(404, { error: (err as Error).message });
  }
});

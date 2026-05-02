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

// Cap a single top-up at $10,000 to prevent runaway charges.
const MAX_TOPUP_CENTS = 1_000_000;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
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

    const amountInCents = typeof body.amountInCents === "number" ? body.amountInCents : NaN;
    const returnUrl = typeof body.returnUrl === "string" ? body.returnUrl : undefined;
    const environment = body.environment === "live" ? "live" : "sandbox";

    if (!Number.isFinite(amountInCents) || amountInCents < 100) {
      return json(400, { error: "Amount must be at least $1.00" });
    }
    if (amountInCents > MAX_TOPUP_CENTS) {
      return json(400, { error: "Amount exceeds the maximum top-up limit" });
    }

    const env = environment as StripeEnv;
    const stripe = createStripeClient(env);

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "Wallet Top-Up" },
            unit_amount: Math.round(amountInCents),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      ui_mode: "embedded_page",
      return_url: returnUrl || `${req.headers.get("origin")}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      ...(user.email && { customer_email: user.email }),
      metadata: {
        userId: user.id,
        purpose: "wallet_topup",
      },
      payment_intent_data: {
        metadata: {
          userId: user.id,
          purpose: "wallet_topup",
        },
      },
    });

    if (!session.client_secret) {
      console.error("[create-wallet-checkout] Stripe returned no client_secret", session.id);
      return json(502, { error: "Stripe did not return a client secret" });
    }

    return json(200, { clientSecret: session.client_secret });
  } catch (error) {
    console.error("[create-wallet-checkout] error:", error);
    return json(500, { error: (error as Error).message || "Internal error" });
  }
});

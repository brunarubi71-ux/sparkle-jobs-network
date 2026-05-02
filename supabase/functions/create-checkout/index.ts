import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";
import { resolveSubscriptionPriceId } from "../_shared/subscription-prices.ts";

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
    // --- Auth: validate JWT and derive userId ---
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

    const { priceId, quantity, returnUrl, environment } = await req.json();
    if (!priceId || typeof priceId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(priceId)) {
      return json(400, { error: "Invalid priceId" });
    }

    const env = (environment || 'sandbox') as StripeEnv;
    const stripe = createStripeClient(env);

    const resolvedPriceId = resolveSubscriptionPriceId(priceId, env);
    const stripePrice = await stripe.prices.retrieve(resolvedPriceId, { expand: ["product"] });
    if (!stripePrice) {
      return json(404, { error: "Price not found" });
    }
    if (stripePrice.active === false) {
      console.warn(`[create-checkout] activating inactive price ${stripePrice.id}`);
      await stripe.prices.update(stripePrice.id, { active: true });
    }
    const product = stripePrice.product;
    const productId = typeof product === "string" ? product : product?.id;
    if (productId && typeof product !== "string" && product.active === false) {
      console.warn(`[create-checkout] activating inactive product ${productId}`);
      await stripe.products.update(productId, { active: true });
    } else if (productId && typeof product === "string") {
      const stripeProduct = await stripe.products.retrieve(productId);
      if (stripeProduct.active === false) {
        console.warn(`[create-checkout] activating inactive product ${productId}`);
        await stripe.products.update(productId, { active: true });
      }
    }
    const isRecurring = stripePrice.type === "recurring";

    // Use authenticated user's ID and email — never trust client-supplied userId
    const userId = user.id;
    const customerEmail = user.email;

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: quantity || 1 }],
      mode: isRecurring ? "subscription" : "payment",
      ui_mode: "embedded_page",
      payment_method_types: ["card"],
      return_url: returnUrl || `${req.headers.get("origin")}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      ...(customerEmail && { customer_email: customerEmail }),
      metadata: { userId },
      ...(isRecurring && {
        subscription_data: {
          trial_period_days: 7,
          metadata: { userId },
        },
      }),
    });

    return json(200, { clientSecret: session.client_secret });
  } catch (error) {
    const message = (error as Error)?.message || String(error);
    console.error("[create-checkout] error:", message, (error as Error)?.stack);
    return json(500, { error: "Checkout failed. Please try again." });
  }
});

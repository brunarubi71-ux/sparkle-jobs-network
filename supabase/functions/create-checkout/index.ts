import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";
import { resolveSubscriptionPriceId } from "../_shared/subscription-prices.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { priceId, quantity, customerEmail, userId, returnUrl, environment } = await req.json();
    if (!priceId || typeof priceId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(priceId)) {
      return new Response(JSON.stringify({ error: "Invalid priceId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const env = (environment || "sandbox") as StripeEnv;
    const stripe = createStripeClient(env);

    // Check if this user has already used their free trial so we don't grant a second one.
    let trialEligible = true;
    if (userId) {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          auth: { persistSession: false },
        });
        const { data: profile } = await adminClient
          .from("profiles")
          .select("free_trial_started_at")
          .eq("id", userId)
          .maybeSingle();
        if (profile?.free_trial_started_at) {
          trialEligible = false;
          console.log(`[create-checkout] user ${userId} already used trial — skipping trial_period_days`);
        }
      }
    }

    const resolvedPriceId = resolveSubscriptionPriceId(priceId, env);
    const stripePrice = await stripe.prices.retrieve(resolvedPriceId, { expand: ["product"] });
    if (!stripePrice) {
      return new Response(JSON.stringify({ error: "Price not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: quantity || 1 }],
      mode: isRecurring ? "subscription" : "payment",
      ui_mode: "embedded",
      payment_method_types: ["card"],
      // Always collect card info upfront, even during a free trial, so the subscription
      // auto-renews without interruption when the trial period ends.
      payment_method_collection: "always",
      return_url: returnUrl ||
        `${req.headers.get("origin")}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      ...(customerEmail && { customer_email: customerEmail }),
      ...(userId && { metadata: { userId } }),
      ...(isRecurring && {
        subscription_data: {
          // Only grant trial to users who haven't tried before.
          ...(trialEligible && { trial_period_days: 7 }),
          // If payment method is removed before trial ends, cancel instead of leaving a broken sub.
          trial_settings: {
            end_behavior: { missing_payment_method: "cancel" },
          },
          ...(userId && { metadata: { userId } }),
        },
      }),
    });

    return new Response(JSON.stringify({ clientSecret: session.client_secret, trialEligible }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = (error as Error)?.message || String(error);
    console.error("[create-checkout] error:", message, (error as Error)?.stack);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

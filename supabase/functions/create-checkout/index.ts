import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";
import { resolveSubscriptionPriceId } from "../_shared/subscription-prices.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { priceId, quantity, customerEmail, userId, returnUrl, environment } = await req.json();
    if (!priceId || typeof priceId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(priceId)) {
      return new Response(JSON.stringify({ error: "Invalid priceId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const env = (environment || 'sandbox') as StripeEnv;
    const stripe = createStripeClient(env);

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
      ui_mode: "embedded_page",
      payment_method_types: ["card"],
      return_url: returnUrl || `${req.headers.get("origin")}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      ...(customerEmail && { customer_email: customerEmail }),
      ...(userId && { metadata: { userId } }),
      ...(isRecurring && {
        subscription_data: {
          trial_period_days: 7,
          ...(userId && { metadata: { userId } }),
        },
      }),
    });

    return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
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

// supabase/functions/stripe-webhook/index.ts
//
// SHINELY: Stripe -> Supabase webhook
//
// Tier resolution uses Stripe price IDs (PRICE_ID_TO_PLAN below). When a
// subscription's price is not recognized, we leave plan_tier/is_premium
// untouched on active/trialing subs to avoid silently downgrading paying
// customers. Inactive subs always reset to "free".

import Stripe from "https://esm.sh/stripe@14.21.0?target=denonext";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

// Keep in sync with supabase/functions/_shared/subscription-prices.ts
const PRICE_ID_TO_PLAN: Record<string, "pro" | "premium"> = {
  // SHINELY APP live account (acct_1TNGWHE6CWgPDhI7)
  price_1TRE34E6CWgPDhI7jctgKXwa: "pro",
  price_1TRE33E6CWgPDhI7NtK2ktCO: "pro",
  price_1TRE32E6CWgPDhI7zh0wZ6Vg: "premium",
  price_1TRE32E6CWgPDhI7RRYTHjDx: "premium",
};

const ACTIVE_STATUSES = new Set(["active", "trialing"]);
const cryptoProvider = Stripe.createSubtleCryptoProvider();

// Try each configured secret in order; first match wins.
// STRIPE_WEBHOOK_SECRET      → live destination
// STRIPE_WEBHOOK_SECRET_TEST → sandbox/test destination (optional)
async function verifySignature(body: string, signature: string): Promise<Stripe.Event> {
  const secrets = [
    Deno.env.get("STRIPE_WEBHOOK_SECRET"),
    Deno.env.get("STRIPE_WEBHOOK_SECRET_TEST"),
  ].filter(Boolean) as string[];

  for (const secret of secrets) {
    try {
      return await stripe.webhooks.constructEventAsync(
        body, signature, secret, undefined, cryptoProvider,
      );
    } catch {
      // try next secret
    }
  }
  throw new Error("No configured webhook secret matched the request signature");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = await verifySignature(body, signature);
  } catch (err) {
    console.error("Signature verification failed:", err);
    return new Response(`Webhook Error: ${(err as Error).message}`, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("webhook_events")
    .select("id, processed_at")
    .eq("stripe_event_id", event.id)
    .maybeSingle();

  if (existing?.processed_at) {
    return jsonResponse({ received: true, duplicate: true });
  }

  await supabase.from("webhook_events").upsert({
    stripe_event_id: event.id,
    event_type: event.type,
    payload: event as unknown as Record<string, unknown>,
  }, { onConflict: "stripe_event_id" });

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpsert(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_succeeded":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case "invoice.payment_failed":
        await handleInvoiceFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    await supabase
      .from("webhook_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("stripe_event_id", event.id);

    return jsonResponse({ received: true });
  } catch (err) {
    console.error("Handler error:", err);
    await supabase
      .from("webhook_events")
      .update({ error: String(err) })
      .eq("stripe_event_id", event.id);
    return new Response(`Handler Error: ${(err as Error).message}`, { status: 500 });
  }
});

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const purpose = session.metadata?.purpose;
  const userId = session.metadata?.userId;

  // For subscription checkouts: always keep stripe_customer_id in sync so future
  // events resolve the user correctly. This also handles the case where a user
  // previously had a different customer ID (e.g. from an old test checkout).
  if (!purpose && userId && session.customer) {
    const customerId = typeof session.customer === "string" ? session.customer : (session.customer as any).id;
    const { error: linkErr } = await supabase
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", userId);
    if (linkErr) console.error("[checkout.completed] failed to link stripe_customer_id:", linkErr);
    else console.log(`[checkout.completed] linked stripe_customer_id ${customerId} to user ${userId}`);
  }

  if (session.payment_status !== "paid") return;

  if (purpose === "job_payment") {
    const jobId = session.metadata?.jobId;
    if (!jobId) {
      console.error("[checkout.completed] job_payment missing jobId in metadata");
      return;
    }
    const { error } = await supabase
      .from("jobs")
      .update({ status: "open" })
      .eq("id", jobId)
      .in("status", ["pending_payment", "draft"]);
    if (error) console.error("[checkout.completed] failed to activate job:", error);
    else console.log(`[checkout.completed] activated job ${jobId}`);
  } else if (purpose === "wallet_topup") {
    if (!userId) {
      console.error("[checkout.completed] wallet_topup missing userId in metadata");
      return;
    }
    const amountInDollars = session.amount_total ? session.amount_total / 100 : 0;
    if (amountInDollars <= 0) return;
    const { error } = await supabase.rpc("credit_wallet", {
      p_user_id: userId,
      p_amount: amountInDollars,
      p_description: "Wallet top-up via Stripe",
      p_job_id: null,
    });
    if (error) console.error("[checkout.completed] failed to credit wallet:", error);
    else console.log(`[checkout.completed] credited wallet for user ${userId} $${amountInDollars}`);
  }
}

async function handleSubscriptionUpsert(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const item = sub.items.data[0];
  const priceId = item.price.id;
  const productId = typeof item.price.product === "string"
    ? item.price.product
    : item.price.product.id;

  // Determine environment from livemode flag on the subscription object
  const environment: "live" | "sandbox" = sub.livemode ? "live" : "sandbox";

  // Resolve tier: first from price ID map, then from subscription metadata (set by create-checkout)
  const tierFromPrice = PRICE_ID_TO_PLAN[priceId] ?? null;
  const tierFromMeta = (sub.metadata?.planTier as "pro" | "premium") ?? null;
  const knownTier: "pro" | "premium" | null = tierFromPrice ?? tierFromMeta;

  const isActive = ACTIVE_STATUSES.has(sub.status);

  // Primary: resolve user from stripe_customer_id or email lookup.
  // Fallback: use userId embedded in subscription metadata by create-checkout.
  let userId = await resolveUserId(customerId);
  if (!userId && sub.metadata?.userId) {
    userId = sub.metadata.userId;
    console.log(`[sub.upsert] resolved userId from sub.metadata: ${userId}`);
  }
  if (!userId) {
    console.warn(`[sub.upsert] skipping: no Supabase user for stripe customer ${customerId}`);
    return;
  }

  // Always keep stripe_customer_id in sync on the profile
  await supabase
    .from("profiles")
    .update({ stripe_customer_id: customerId })
    .eq("id", userId)
    .is("stripe_customer_id", null);

  const { error: upsertErr } = await supabase.from("subscriptions").upsert({
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    status: sub.status,
    plan_name: knownTier ?? "unknown",
    product_id: productId,
    price_id: priceId,
    environment,
    current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
    current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
    cancel_at_period_end: sub.cancel_at_period_end,
    trial_start: sub.trial_start ? new Date(sub.trial_start * 1000).toISOString() : null,
    trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
  }, { onConflict: "stripe_subscription_id" });
  if (upsertErr) console.error("[sub.upsert] subscriptions upsert error:", upsertErr);

  if (!knownTier && isActive) {
    // Tier still unknown (price not in map, no metadata) — mark as premium so the
    // user isn't stuck on "free" while paying. plan_tier stays unchanged to avoid
    // silently downgrading a user already on a known tier.
    console.warn(
      `[sub.upsert] unknown price ${priceId} on active sub ${sub.id} — marking is_premium only`,
    );
    await supabase
      .from("profiles")
      .update({
        is_premium: true,
        premium_status: sub.status,
        free_trial_started_at: sub.trial_start ? new Date(sub.trial_start * 1000).toISOString() : null,
        free_trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
      })
      .eq("id", userId);
    return;
  }

  await supabase
    .from("profiles")
    .update({
      is_premium: isActive,
      premium_status: sub.status,
      plan_tier: isActive ? knownTier! : "free",
      free_trial_started_at: sub.trial_start ? new Date(sub.trial_start * 1000).toISOString() : null,
      free_trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    })
    .eq("id", userId);

  console.log(`[sub.upsert] updated user ${userId} → plan_tier=${isActive ? knownTier : "free"} status=${sub.status}`);
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const { data: existingSub } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_subscription_id", sub.id)
    .maybeSingle();
  if (!existingSub) return;

  await supabase
    .from("subscriptions")
    .update({ status: "canceled" })
    .eq("stripe_subscription_id", sub.id);

  await supabase
    .from("profiles")
    .update({ is_premium: false, premium_status: "canceled", plan_tier: "free" })
    .eq("id", existingSub.user_id);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  if (!invoice.subscription) return;
  const subId = typeof invoice.subscription === "string"
    ? invoice.subscription
    : invoice.subscription.id;
  await supabase.from("subscriptions").update({ status: "active" }).eq("stripe_subscription_id", subId);
}

async function handleInvoiceFailed(invoice: Stripe.Invoice) {
  if (!invoice.subscription) return;
  const subId = typeof invoice.subscription === "string"
    ? invoice.subscription
    : invoice.subscription.id;
  await supabase.from("subscriptions").update({ status: "past_due" }).eq("stripe_subscription_id", subId);
}

async function resolveUserId(customerId: string): Promise<string | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (profile) return profile.id;

  const { data: existingSub } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (existingSub) return existingSub.user_id;

  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer && !("deleted" in customer) && customer.email) {
      const { data: byEmail } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", customer.email)
        .maybeSingle();
      if (byEmail) return byEmail.id;
    }
  } catch (err) {
    console.error(`Could not retrieve Stripe customer ${customerId}:`, err);
  }

  return null;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createStripeClient } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const MIN_WITHDRAWAL_CENTS = 500; // $5.00 minimum

// Instant payout fee: 1.5%, minimum $0.50
function calcInstantFee(amountCents: number): number {
  return Math.max(50, Math.round(amountCents * 0.015));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authorization = req.headers.get("Authorization");
    if (!authorization) return json(401, { error: "Not authenticated" });

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return json(401, { error: "Session expired" });

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let body: Record<string, unknown>;
    try { body = await req.json(); }
    catch { return json(400, { error: "Invalid request body" }); }

    const amountDollars = typeof body.amount === "number" ? body.amount : NaN;
    const instant = body.instant === true;

    if (!Number.isFinite(amountDollars) || amountDollars <= 0) {
      return json(400, { error: "Invalid amount" });
    }
    const amountCents = Math.round(amountDollars * 100);
    if (amountCents < MIN_WITHDRAWAL_CENTS) {
      return json(400, { error: "Minimum withdrawal is $5.00" });
    }

    // For instant payouts the fee is deducted by Stripe from what the cleaner receives.
    // We still deduct the full requested amount from the wallet so the books balance.
    const instantFeeCents = instant ? calcInstantFee(amountCents) : 0;

    // Load profile
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("wallet_balance, stripe_connect_account_id, stripe_connect_onboarded")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) return json(500, { error: "Could not load profile" });

    if (!profile.stripe_connect_account_id || !profile.stripe_connect_onboarded) {
      return json(400, { error: "Bank account not set up. Please complete onboarding first." });
    }

    const currentBalance = Number(profile.wallet_balance || 0);
    if (amountDollars > currentBalance) {
      return json(400, { error: "Insufficient wallet balance" });
    }

    // Record the withdrawal request
    const { data: withdrawal, error: wErr } = await adminClient
      .from("withdrawal_requests")
      .insert({
        user_id: user.id,
        amount: amountDollars,
        status: "processing",
      })
      .select()
      .single();

    if (wErr || !withdrawal) return json(500, { error: "Could not create withdrawal record" });

    const stripe = createStripeClient("live");
    const connectAccountId: string = profile.stripe_connect_account_id;

    try {
      // 1. Debit wallet FIRST — if this fails the Stripe transfer never happens,
      //    so there is no risk of money leaving the platform without a matching debit.
      const { error: debitErr } = await authClient.rpc("debit_wallet", {
        p_amount: amountDollars,
        p_description: instant
          ? `Instant withdrawal to bank account`
          : `Standard withdrawal to bank account`,
        p_job_id: null,
      });
      if (debitErr) {
        await adminClient
          .from("withdrawal_requests")
          .update({ status: "failed", failure_reason: debitErr.message })
          .eq("id", withdrawal.id);
        return json(400, { error: debitErr.message || "Wallet debit failed" });
      }

      // In test mode: ensure platform has enough Stripe balance before transferring.
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
      if (stripeKey.startsWith("sk_test_")) {
        try {
          await (stripe as any).testHelpers.topups.create({
            amount: amountCents + 10000,
            currency: "usd",
            description: "Test balance top-up for worker payout",
          });
        } catch (topupErr) {
          console.warn("[create-payout] test topup failed (non-fatal):", topupErr);
        }
      }

      // 2. Transfer funds from platform → connected account
      const transfer = await stripe.transfers.create({
        amount: amountCents,
        currency: "usd",
        destination: connectAccountId,
        metadata: {
          userId: user.id,
          withdrawalId: withdrawal.id,
          instant: String(instant),
        },
      });

      // 3. If instant, immediately trigger a payout from the connected account's balance
      //    Stripe charges the 1.5% instant fee and the cleaner receives the remainder.
      let payoutId: string | null = null;
      if (instant) {
        try {
          const payout = await stripe.payouts.create(
            {
              amount: amountCents,
              currency: "usd",
              method: "instant",
              metadata: {
                userId: user.id,
                withdrawalId: withdrawal.id,
              },
            },
            { stripeAccount: connectAccountId },
          );
          payoutId = payout.id;
        } catch (instantErr) {
          // If instant payout fails (e.g. no eligible debit card), fall back to standard
          console.error("[create-payout] instant payout failed, falling back:", instantErr);
          await stripe.payouts.create(
            { amount: amountCents, currency: "usd", method: "standard" },
            { stripeAccount: connectAccountId },
          );
        }
      }

      // 4. Mark done
      await adminClient
        .from("withdrawal_requests")
        .update({
          status: "paid",
          stripe_transfer_id: transfer.id,
        })
        .eq("id", withdrawal.id);

      const netReceived = (amountCents - instantFeeCents) / 100;

      return json(200, {
        success: true,
        transferId: transfer.id,
        payoutId,
        instant,
        amount: amountDollars,
        feeDollars: instantFeeCents / 100,
        netReceived,
        newBalance: Math.max(0, currentBalance - amountDollars),
        estimatedArrival: instant ? "within 30 minutes" : "2–5 business days",
      });
    } catch (stripeErr) {
      // Wallet was debited before Stripe was called. Since Stripe failed,
      // refund the wallet so the cleaner keeps their balance.
      try {
        await adminClient.rpc("credit_wallet", {
          p_user_id: user.id,
          p_amount: amountDollars,
          p_description: "Withdrawal refund — transfer failed",
          p_job_id: null,
        });
      } catch (refundErr) {
        console.error("[create-payout] CRITICAL: wallet refund failed after Stripe error:", refundErr);
      }

      await adminClient
        .from("withdrawal_requests")
        .update({
          status: "failed",
          failure_reason: (stripeErr as Error).message,
        })
        .eq("id", withdrawal.id);

      console.error("[create-payout] Stripe error:", stripeErr);
      return json(502, { error: "Transfer failed. Your balance was restored. Please try again or contact support." });
    }
  } catch (err) {
    console.error("[create-payout]", err);
    return json(500, { error: (err as Error).message || "Internal error" });
  }
});

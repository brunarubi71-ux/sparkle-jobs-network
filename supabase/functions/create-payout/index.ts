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

// Minimum withdrawal: $5.00
const MIN_WITHDRAWAL_CENTS = 500;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authorization = req.headers.get("Authorization");
    if (!authorization) return json(401, { error: "Not authenticated" });

    // Verify session
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return json(401, { error: "Session expired" });

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json(400, { error: "Invalid request body" });
    }

    const amountDollars = typeof body.amount === "number" ? body.amount : NaN;
    if (!Number.isFinite(amountDollars) || amountDollars <= 0) {
      return json(400, { error: "Invalid amount" });
    }
    const amountCents = Math.round(amountDollars * 100);
    if (amountCents < MIN_WITHDRAWAL_CENTS) {
      return json(400, { error: "Minimum withdrawal is $5.00" });
    }

    // Load profile with balance and connect account
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

    // Create a withdrawal request record (status: processing)
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

    try {
      // Transfer from platform account to connected account
      const transfer = await stripe.transfers.create({
        amount: amountCents,
        currency: "usd",
        destination: profile.stripe_connect_account_id,
        metadata: {
          userId: user.id,
          withdrawalId: withdrawal.id,
          purpose: "cleaner_payout",
        },
      });

      // Deduct from wallet atomically using the existing debit_wallet RPC
      const { error: walletErr } = await adminClient.rpc("debit_wallet" as any, {
        p_user_id: user.id,
        p_amount: amountDollars,
        p_description: `Withdrawal to bank account`,
        p_job_id: null,
      });

      if (walletErr) {
        // Transfer succeeded but wallet debit failed — mark as paid anyway and log
        console.error("[create-payout] wallet debit error after successful transfer:", walletErr);
      }

      // Mark withdrawal as paid
      await adminClient
        .from("withdrawal_requests")
        .update({ status: "paid", stripe_transfer_id: transfer.id })
        .eq("id", withdrawal.id);

      return json(200, {
        success: true,
        transferId: transfer.id,
        amount: amountDollars,
        newBalance: Math.max(0, currentBalance - amountDollars),
      });
    } catch (stripeErr) {
      // Mark withdrawal as failed
      await adminClient
        .from("withdrawal_requests")
        .update({
          status: "failed",
          failure_reason: (stripeErr as Error).message,
        })
        .eq("id", withdrawal.id);

      console.error("[create-payout] Stripe transfer error:", stripeErr);
      return json(502, { error: "Transfer failed. Please try again or contact support." });
    }
  } catch (err) {
    console.error("[create-payout]", err);
    return json(500, { error: (err as Error).message || "Internal error" });
  }
});

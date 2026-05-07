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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authorization = req.headers.get("Authorization");
    if (!authorization) return json(401, { error: "Not authenticated" });

    // Verify user session
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return json(401, { error: "Session expired" });

    // Service-role client for DB writes
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const returnUrl: string = body.returnUrl || `${req.headers.get("origin") || "https://shinelyapp.lovable.app"}/earnings`;

    // Get existing profile
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("stripe_connect_account_id, stripe_connect_onboarded, email, full_name")
      .eq("id", user.id)
      .single();

    if (profileError) return json(500, { error: "Could not load profile" });

    const stripe = createStripeClient("live");

    let accountId: string = profile.stripe_connect_account_id || "";

    // Create a new Express account if one doesn't exist yet
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "BR",
        email: profile.email || user.email || undefined,
        capabilities: {
          transfers: { requested: true },
        },
        business_type: "individual",
        settings: {
          payouts: {
            schedule: { interval: "manual" },
          },
        },
        metadata: { userId: user.id },
      });
      accountId = account.id;

      await adminClient
        .from("profiles")
        .update({ stripe_connect_account_id: accountId })
        .eq("id", user.id);
    }

    // Generate (or refresh) the onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${returnUrl}?connect=refresh`,
      return_url:  `${returnUrl}?connect=success`,
      type: "account_onboarding",
    });

    return json(200, { url: accountLink.url, accountId });
  } catch (err) {
    console.error("[create-connect-account]", err);
    return json(500, { error: (err as Error).message || "Internal error" });
  }
});

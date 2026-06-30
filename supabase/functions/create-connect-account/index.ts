import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createStripeClient } from "../_shared/stripe.ts";
import { safeReturnUrl } from "../_shared/safe-return-url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ok = (body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authorization = req.headers.get("Authorization");
    if (!authorization) return ok({ error: "Not authenticated" });

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) return ok({ error: "Session expired" });

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const returnUrl: string = safeReturnUrl(body.returnUrl, req.headers.get("origin"), "/earnings");

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("stripe_connect_account_id, stripe_connect_onboarded, email, full_name")
      .eq("id", user.id)
      .single();

    if (profileError) return ok({ error: "Could not load profile" });

    const stripe = createStripeClient("live");

    let accountId: string = profile.stripe_connect_account_id || "";

    if (!accountId) {
      let account;
      try {
        account = await stripe.accounts.create({
          type: "express",
          email: profile.email || user.email || undefined,
          capabilities: {
            transfers: { requested: true },
          },
          metadata: { userId: user.id },
        });
      } catch (stripeErr: any) {
        console.error("[create-connect-account] accounts.create:", stripeErr?.code, stripeErr?.type, stripeErr?.message);
        return ok({ error: "Could not create payout account. Please try again." });
      }

      accountId = account.id;
      await adminClient
        .from("profiles")
        .update({ stripe_connect_account_id: accountId })
        .eq("id", user.id);
    }

    let accountLink;
    try {
      accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${returnUrl}?connect=refresh`,
        return_url: `${returnUrl}?connect=success`,
        type: "account_onboarding",
      });
    } catch (stripeErr: any) {
      console.error("[create-connect-account] accountLinks.create:", stripeErr?.message);
      return ok({ error: "Could not create onboarding link. Please try again." });
    }

    return ok({ url: accountLink.url, accountId });
  } catch (err) {
    console.error("[create-connect-account] unexpected:", err);
    return ok({ error: "An internal error occurred. Please try again." });
  }
});

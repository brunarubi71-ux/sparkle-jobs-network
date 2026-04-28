import { loadStripe, Stripe } from "@stripe/stripe-js";
import { supabase } from "@/integrations/supabase/client";

// TEMPORARY: Hardcoded sandbox publishable key for acct_1TM8dFBVtJFDwiED
// to match the backend (which is also forced to sandbox). This guarantees
// the frontend Stripe.js key matches the backend secret key, regardless of
// which env file the build picked up.
// When ready to accept real payments, restore:
//   const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;
//   const environment = clientToken?.startsWith('pk_test_') ? 'sandbox' : 'live';
const clientToken = 'pk_test_51TM8dFBVtJFDwiEDQt40qVrprjVY8EJtcL9FnxOd30elTOGYpO7BUeP1ywGQMLKDkzx5LTD13MC45gIBbwIxM3pH00ITjyfw2L';
const environment = 'sandbox';

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    if (!clientToken) {
      throw new Error("VITE_PAYMENTS_CLIENT_TOKEN is not set");
    }
    stripePromise = loadStripe(clientToken);
  }
  return stripePromise;
}

export async function getStripePriceId(priceId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("get-stripe-price", {
    body: { priceId, environment },
  });
  if (error || !data?.stripeId) {
    throw new Error(`Failed to resolve price: ${priceId}`);
  }
  return data.stripeId;
}

export function getStripeEnvironment(): string {
  return environment;
}

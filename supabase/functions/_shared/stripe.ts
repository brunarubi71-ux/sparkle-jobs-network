import Stripe from "https://esm.sh/stripe@14.21.0?target=denonext";

const getEnv = (key: string): string => {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`${key} is not configured`);
  return value;
};

export type StripeEnv = "sandbox" | "live";

export function createStripeClient(_env: StripeEnv = "live"): Stripe {
  return new Stripe(getEnv("STRIPE_SECRET_KEY"), {
    apiVersion: "2024-06-20",
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export async function verifyWebhook(
  req: Request,
  _env: StripeEnv = "live",
): Promise<Stripe.Event> {
  const stripe = createStripeClient();
  const signature = req.headers.get("stripe-signature");
  if (!signature) throw new Error("Missing stripe-signature header");
  const body = await req.text();
  return await stripe.webhooks.constructEventAsync(
    body,
    signature,
    getEnv("STRIPE_WEBHOOK_SECRET"),
    undefined,
    Stripe.createSubtleCryptoProvider(),
  );
}

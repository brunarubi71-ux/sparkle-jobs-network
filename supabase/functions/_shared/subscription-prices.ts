export const SUBSCRIPTION_PRICE_IDS: Record<string, Record<string, string>> = {
  sandbox: {
    // RUBI SOLUTIONS CORP test account (acct_1TM8dFBVtJFDwiED)
    pro_monthly: "price_1TR03SBVtJFDwiEDDagq8ul5",
    pro_annual: "price_1TR03VBVtJFDwiEDTttQmLyu",
    premium_monthly: "price_1TR03YBVtJFDwiEDVyOCdKyg",
    premium_annual: "price_1TR03bBVtJFDwiED5FCTus5s",
  },
  live: {
    // SHINELY APP live account (acct_1TNGWHE6CWgPDhI7).
    // Logical IDs are resolved to real Stripe price IDs by the connector
    // gateway per environment — no need to hardcode price_xxx values here.
    pro_monthly: "pro_monthly",
    pro_annual: "pro_annual",
    premium_monthly: "premium_monthly",
    premium_annual: "premium_annual",
  },
};

export const PRICE_ID_TO_PLAN: Record<string, "pro" | "premium"> = {
  pro_monthly: "pro",
  pro_annual: "pro",
  premium_monthly: "premium",
  premium_annual: "premium",
  price_1TR03SBVtJFDwiEDDagq8ul5: "pro",
  price_1TR03VBVtJFDwiEDTttQmLyu: "pro",
  price_1TR03YBVtJFDwiEDVyOCdKyg: "premium",
  price_1TR03bBVtJFDwiED5FCTus5s: "premium",
};

export function resolveSubscriptionPriceId(priceId: string, environment: string): string {
  if (priceId.startsWith("price_")) return priceId;
  const mapped = SUBSCRIPTION_PRICE_IDS[environment]?.[priceId];
  if (!mapped) {
    throw new Error(
      `No Stripe price mapping for "${priceId}" in environment "${environment}". Update supabase/functions/_shared/subscription-prices.ts.`
    );
  }
  return mapped;
}

export function getPlanFromPriceId(priceId?: string | null): "pro" | "premium" {
  if (!priceId) return "pro";
  return PRICE_ID_TO_PLAN[priceId] ?? (priceId.includes("premium") ? "premium" : "pro");
}

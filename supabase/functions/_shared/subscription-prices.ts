export const SUBSCRIPTION_PRICE_IDS: Record<string, Record<string, string>> = {
  sandbox: {
    pro_monthly: "price_1TR03SBVtJFDwiEDDagq8ul5",
    pro_annual: "price_1TR03VBVtJFDwiEDTttQmLyu",
    premium_monthly: "price_1TR03YBVtJFDwiEDVyOCdKyg",
    premium_annual: "price_1TR03bBVtJFDwiED5FCTus5s",
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
  return SUBSCRIPTION_PRICE_IDS[environment]?.[priceId] ?? priceId;
}

export function getPlanFromPriceId(priceId?: string | null): "pro" | "premium" {
  if (!priceId) return "pro";
  return PRICE_ID_TO_PLAN[priceId] ?? (priceId.includes("premium") ? "premium" : "pro");
}
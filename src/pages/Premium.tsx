import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { Crown, Check, Sparkles, Zap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import BottomNav from "@/components/BottomNav";
import { useEffect, useState } from "react";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { format } from "date-fns";
import { toast } from "sonner";

interface SubRow {
  id: string;
  plan_name: string | null;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
}

const proBenefits = [
  { icon: "⚡", text: "7 job applications per week" },
  { icon: "🎯", text: "Priority job access" },
  { icon: "👁️", text: "Increased visibility" },
  { icon: "📅", text: "1 schedule contact per week" },
  { icon: "🎁", text: "7-day free trial" },
];

const premiumBenefits = [
  { icon: "🚀", text: "Unlimited jobs per week" },
  { icon: "⭐", text: "Top profile placement" },
  { icon: "📅", text: "Unlimited schedule contacts" },
  { icon: "🏅", text: "Premium badge on profile" },
  { icon: "🎁", text: "7-day free trial" },
];

const planLabel: Record<string, string> = { free: "Free", pro: "Pro", premium: "Premium" };

type Billing = "monthly" | "annual";

const PRICES = {
  pro: { monthly: { id: "pro_monthly", amount: 14.99 }, annual: { id: "pro_annual", amount: 149 } },
  premium: { monthly: { id: "premium_monthly", amount: 29.99 }, annual: { id: "premium_annual", amount: 299 } },
};

export default function Premium() {
  const { user, profile, refreshProfile } = useAuth();
  const [activeSub, setActiveSub] = useState<SubRow | null>(null);
  const [checkoutPriceId, setCheckoutPriceId] = useState<string | null>(null);
  const [billing, setBilling] = useState<Billing>("monthly");
  const [portalLoading, setPortalLoading] = useState(false);

  const currentTier = (profile?.plan_tier || "free") as "free" | "pro" | "premium";
  const isPaid = currentTier !== "free";
  const isOwner = profile?.role === "owner";

  useEffect(() => {
    if (isOwner) return;
    const load = async () => {
      if (!user) return;
      await refreshProfile();
      const { data } = await supabase
        .from("subscriptions")
        .select("id, plan_name, status, current_period_start, current_period_end, created_at")
        .eq("user_id", user.id)
        .eq("environment", getStripeEnvironment())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setActiveSub((data as SubRow) || null);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isOwner]);

  // Subscriptions are only for cleaners/helpers — never for job owners.
  if (isOwner) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <Crown className="w-12 h-12 text-primary mb-4" />
        <h1 className="text-2xl font-bold text-foreground mb-2">Premium plans are for Cleaners and Helpers</h1>
        <p className="text-sm text-muted-foreground max-w-sm mb-6">
          As a Job Owner, you don't need a subscription. A 10% platform fee is collected automatically when you book a job.
        </p>
        <Button onClick={() => (window.location.href = "/")} className="rounded-xl">
          Back to home
        </Button>
        <BottomNav />
      </div>
    );
  }

  const userBenefits = currentTier === "premium" ? premiumBenefits : currentTier === "pro" ? proBenefits : [];

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-portal-session", {
        body: {
          environment: getStripeEnvironment(),
          returnUrl: `${window.location.origin}/premium`,
        },
      });
      if (error) throw new Error(error.message || "Could not open billing portal");
      if (data?.error) throw new Error(data.message || "No active subscription on this account.");
      if (!data?.url) throw new Error("Could not open billing portal");
      window.open(data.url, "_blank");
    } catch (e) {
      toast.error((e as Error).message || "Failed to open billing portal");
    } finally {
      setPortalLoading(false);
    }
  };

  const proPrice = PRICES.pro[billing];
  const premiumPrice = PRICES.premium[billing];
  const priceSuffix = billing === "monthly" ? "/mo" : "/yr";
  const activePriceLabel = (tier: "pro" | "premium") => {
    const p = PRICES[tier][billing];
    return `$${p.amount}${priceSuffix}`;
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <PaymentTestModeBanner />

      {/* Header */}
      <div className="gradient-premium px-6 pt-12 pb-20 text-center relative overflow-hidden">
        <div className="absolute top-4 right-6 opacity-20">
          <Sparkles className="w-20 h-20 text-primary-foreground" />
        </div>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-20 h-20 rounded-full bg-primary-foreground/20 mx-auto flex items-center justify-center mb-4"
        >
          <Crown className="w-10 h-10 text-primary-foreground" />
        </motion.div>
        <h1 className="text-2xl font-bold text-primary-foreground mb-1">My Subscription</h1>
        <p className="text-primary-foreground/80 text-sm">Manage your Shinely plan</p>
      </div>

      <div className="px-4 -mt-12 relative z-10 space-y-4">
        {!isPaid ? (
          <>
            {/* Free banner */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-card rounded-2xl p-5 shadow-elevated text-center"
            >
              <div className="inline-flex items-center gap-1.5 bg-accent text-primary text-[10px] font-bold uppercase tracking-wide px-3 py-1 rounded-full mb-3">
                Free Plan
              </div>
              <h2 className="text-xl font-bold text-foreground mb-1">You've reached your free limit</h2>
              <p className="text-sm text-muted-foreground">
                Upgrade to unlock more jobs and earn more
              </p>
            </motion.div>

            {/* Billing toggle */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.05 }}
              className="bg-card rounded-2xl p-1.5 flex shadow-card"
            >
              <button
                onClick={() => setBilling("monthly")}
                className={`flex-1 h-9 rounded-xl text-xs font-bold transition-all ${
                  billing === "monthly" ? "bg-primary text-primary-foreground shadow-card" : "text-muted-foreground"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling("annual")}
                className={`flex-1 h-9 rounded-xl text-xs font-bold transition-all relative ${
                  billing === "annual" ? "bg-primary text-primary-foreground shadow-card" : "text-muted-foreground"
                }`}
              >
                Annual
                <span className="ml-1 text-[9px] font-bold opacity-90">save ~17%</span>
              </button>
            </motion.div>

            {/* Plan cards */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-2 gap-3"
            >
              {/* Pro */}
              <div className="rounded-2xl border-2 border-primary bg-primary/5 p-4 flex flex-col relative shadow-[0_0_20px_hsl(var(--primary)/0.35)] ring-1 ring-primary/30">
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                  RECOMMENDED ✓
                </div>
                <div className="flex items-center gap-1.5 mb-1 mt-1">
                  <Zap className="w-4 h-4 text-primary" />
                  <p className="font-bold text-foreground">Pro</p>
                </div>
                <p className="text-lg font-extrabold text-foreground leading-tight">
                  ${proPrice.amount}
                  <span className="text-xs font-medium text-muted-foreground">{priceSuffix}</span>
                </p>
                <p className="text-[10px] text-primary font-semibold mt-0.5">7-day free trial</p>
                <ul className="mt-3 mb-4 space-y-1.5 flex-1">
                  {proBenefits.map((b) => (
                    <li key={b.text} className="flex items-start gap-1.5 text-[11px] text-foreground leading-snug">
                      <span className="shrink-0">{b.icon}</span>
                      <span>{b.text}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => setCheckoutPriceId(proPrice.id)}
                  className="w-full h-9 rounded-xl gradient-primary text-primary-foreground font-semibold text-xs hover:opacity-90"
                >
                  Start with Pro →
                </Button>
              </div>

              {/* Premium */}
              <div className="rounded-2xl border border-border bg-card p-4 flex flex-col">
                <div className="flex items-center gap-1.5 mb-1 mt-1">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <p className="font-bold text-foreground">Premium</p>
                </div>
                <p className="text-lg font-extrabold text-foreground leading-tight">
                  ${premiumPrice.amount}
                  <span className="text-xs font-medium text-muted-foreground">{priceSuffix}</span>
                </p>
                <p className="text-[10px] text-primary font-semibold mt-0.5">7-day free trial</p>
                <ul className="mt-3 mb-4 space-y-1.5 flex-1">
                  {premiumBenefits.map((b) => (
                    <li key={b.text} className="flex items-start gap-1.5 text-[11px] text-foreground leading-snug">
                      <span className="shrink-0">{b.icon}</span>
                      <span>{b.text}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => setCheckoutPriceId(premiumPrice.id)}
                  className="w-full h-9 rounded-xl bg-primary/10 text-primary font-semibold text-xs hover:bg-primary/20"
                >
                  Go Premium →
                </Button>
              </div>
            </motion.div>
          </>
        ) : (
          <>
            {/* Active plan card */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-card rounded-2xl p-6 shadow-elevated"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full mb-2">
                    <Crown className="w-3 h-3" />
                    Active
                  </div>
                  <h2 className="text-2xl font-bold text-foreground">{planLabel[currentTier]}</h2>
                </div>
                {activeSub?.current_period_end && (
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {activeSub.status === "trialing" ? "Trial ends" : "Next billing"}
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {format(new Date(activeSub.current_period_end), "MMM d, yyyy")}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2 mb-5 pt-4 border-t border-border">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Your benefits
                </p>
                {userBenefits.map((b) => (
                  <div key={b.text} className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                    <span className="text-sm text-foreground">{b.text}</span>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                disabled={portalLoading}
                className="w-full h-11 rounded-xl border-primary/30 text-primary hover:bg-primary/5 font-semibold text-sm"
                onClick={handleManageSubscription}
              >
                {portalLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Manage Subscription"
                )}
              </Button>
            </motion.div>

            {currentTier === "pro" && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.05 }}
                className="rounded-2xl gradient-primary p-4 shadow-card"
              >
                <p className="text-sm font-bold text-primary-foreground mb-3">
                  ✨ Unlock even more with Premium
                </p>
                <div className="rounded-2xl bg-card/95 p-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <p className="font-bold text-foreground">Premium</p>
                  </div>
                  <p className="text-lg font-extrabold text-foreground leading-tight">
                    $29.99
                    <span className="text-xs font-medium text-muted-foreground">/mo</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground">or $299/yr (save ~17%)</p>
                  <ul className="mt-3 mb-4 space-y-1.5">
                    {premiumBenefits.map((b) => (
                      <li key={b.text} className="flex items-start gap-1.5 text-[11px] text-foreground leading-snug">
                        <span className="shrink-0">{b.icon}</span>
                        <span>{b.text}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    onClick={() => setCheckoutPriceId("premium_monthly")}
                    className="w-full h-10 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm hover:opacity-90"
                  >
                    Upgrade to Premium →
                  </Button>
                </div>
              </motion.div>
            )}
          </>
        )}
      </div>

      {/* Stripe Checkout Dialog */}
      <Dialog open={!!checkoutPriceId} onOpenChange={(open) => !open && setCheckoutPriceId(null)}>
        <DialogContent className="max-w-lg p-0 overflow-hidden rounded-2xl max-h-[90vh] overflow-y-auto">
          {checkoutPriceId && (
            <StripeEmbeddedCheckout
              priceId={checkoutPriceId}
              customerEmail={profile?.email || undefined}
              userId={user?.id}
              returnUrl={`${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`}
            />
          )}
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}

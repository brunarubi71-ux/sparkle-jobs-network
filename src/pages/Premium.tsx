import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { Crown, Check, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import BottomNav from "@/components/BottomNav";
import { useEffect, useState } from "react";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface BillingRow {
  id: string;
  plan_name: string | null;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
}

const proBenefits = [
  { icon: "⚡", text: "5 jobs per week" },
  { icon: "🎯", text: "Priority job access" },
  { icon: "👁️", text: "Increased visibility" },
  { icon: "📅", text: "2 schedule listings" },
];

const premiumBenefits = [
  { icon: "🚀", text: "Unlimited jobs per week" },
  { icon: "⭐", text: "Top profile placement" },
  { icon: "📅", text: "Unlimited schedule listings" },
  { icon: "🏅", text: "Premium badge on profile" },
];

const planLabel: Record<string, string> = { free: "Free", pro: "Pro", premium: "Premium" };
const planPrice: Record<string, string> = { free: "$0", pro: "$9.99/mo", premium: "$19.99/mo" };

export default function Premium() {
  const { user, profile } = useAuth();
  const [history, setHistory] = useState<BillingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutPriceId, setCheckoutPriceId] = useState<string | null>(null);

  const currentTier = (profile?.plan_tier || "free") as "free" | "pro" | "premium";
  const isPaid = currentTier !== "free";

  useEffect(() => {
    const loadHistory = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("subscriptions")
        .select("id, plan_name, status, current_period_start, current_period_end, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setHistory((data as BillingRow[]) || []);
      setLoading(false);
    };
    loadHistory();
  }, [user]);

  const activeSub = history.find((h) => h.status === "active" || h.status === "trialing");
  const userBenefits = currentTier === "premium" ? premiumBenefits : currentTier === "pro" ? proBenefits : [];

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
              <h2 className="text-xl font-bold text-foreground mb-1">You're on the Free Plan</h2>
              <p className="text-sm text-muted-foreground">
                Upgrade to unlock more jobs and earn more
              </p>
            </motion.div>

            {/* Recommendation */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.05 }}
              className="rounded-2xl gradient-primary px-4 py-3 text-center shadow-card"
            >
              <p className="text-sm font-bold text-primary-foreground">
                ✨ We recommend Pro for you!
              </p>
              <p className="text-[11px] text-primary-foreground/90 mt-0.5">
                Most cleaners on Pro earn 3x more per week
              </p>
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
                  $9.99
                  <span className="text-xs font-medium text-muted-foreground">/mo</span>
                </p>
                <ul className="mt-3 mb-4 space-y-1.5 flex-1">
                  {proBenefits.map((b) => (
                    <li key={b.text} className="flex items-start gap-1.5 text-[11px] text-foreground leading-snug">
                      <span className="shrink-0">{b.icon}</span>
                      <span>{b.text}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => setCheckoutPriceId("pro_monthly")}
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
                  $19.99
                  <span className="text-xs font-medium text-muted-foreground">/mo</span>
                </p>
                <ul className="mt-3 mb-4 space-y-1.5 flex-1">
                  {premiumBenefits.map((b) => (
                    <li key={b.text} className="flex items-start gap-1.5 text-[11px] text-foreground leading-snug">
                      <span className="shrink-0">{b.icon}</span>
                      <span>{b.text}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => setCheckoutPriceId("premium_monthly")}
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
                  <p className="text-sm text-muted-foreground">{planPrice[currentTier]}</p>
                </div>
                {activeSub?.current_period_end && (
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Next billing
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
                className="w-full h-11 rounded-xl border-primary/30 text-primary hover:bg-primary/5 font-semibold text-sm"
                onClick={() => {
                  // Placeholder: future Stripe portal integration
                }}
              >
                Manage Subscription
              </Button>
            </motion.div>
          </>
        )}

        {/* Billing history */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="bg-card rounded-2xl p-5 shadow-card"
        >
          <h3 className="font-semibold text-foreground mb-3">Billing History</h3>
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-6">Loading...</p>
          ) : history.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-accent mx-auto flex items-center justify-center mb-2">
                <Receipt className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">No billing history yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Your invoices will appear here once you subscribe
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {history.map((row) => (
                <div key={row.id} className="py-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {row.plan_name || "Subscription"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(row.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-semibold px-2 py-1 rounded-full uppercase ${
                      row.status === "active" || row.status === "trialing"
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {row.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
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

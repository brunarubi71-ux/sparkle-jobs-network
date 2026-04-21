import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { Crown, Sparkles, Zap, Star, Check, TrendingUp, Users, Eye, Rocket, Shield, Lock, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import BottomNav from "@/components/BottomNav";
import { toast } from "sonner";
import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export default function Premium() {
  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [checkoutPriceId, setCheckoutPriceId] = useState<string | null>(null);
  const { t } = useLanguage();

  // Reordered: Free → Pro → Premium (Premium is the HERO)
  const plans = [
    {
      id: "free" as const,
      name: t("premium.free"),
      price: 0,
      period: "",
      features: [
        { icon: Zap, text: t("plan.1_job_weekly") },
        { icon: Lock, text: t("plan.0_contacts") },
        { icon: Flame, text: t("plan.no_urgent_jobs") },
      ],
      cta: "Get Pro",
      urgency: t("premium.free_urgency"),
      highlighted: false,
      badge: null,
      size: "normal",
    },
    {
      id: "pro" as const,
      name: "Pro",
      price: 9.99,
      period: "/month",
      features: [
        { icon: Zap, text: t("plan.5_jobs_weekly") },
        { icon: Users, text: t("plan.1_contact_lifetime") },
        { icon: Flame, text: t("plan.urgent_access") },
        { icon: Shield, text: t("plan.pro_badge") },
        { icon: TrendingUp, text: "Medium priority in Owner searches" },
      ],
      cta: "Upgrade to Premium",
      urgency: t("premium.pro_urgency"),
      highlighted: true,
      badge: t("premium.most_popular"),
      size: "normal",
    },
    {
      id: "premium" as const,
      name: "Premium",
      price: 19.99,
      period: "/month",
      features: [
        { icon: Rocket, text: t("plan.unlimited_jobs") },
        { icon: Users, text: t("plan.unlimited_contacts") },
        { icon: Crown, text: "Badge \"Premium Verified ✦\" on profile" },
        { icon: Eye, text: "Appears FIRST in Owner searches" },
        { icon: Flame, text: t("plan.all_jobs_access") },
        { icon: Shield, text: "Verified identity seal" },
      ],
      cta: "You're all set ✦",
      urgency: t("premium.premium_urgency"),
      highlighted: true,
      badge: t("premium.best_value"),
      size: "hero",
    },
  ];

  const handleUpgrade = (planId: "free" | "premium" | "pro") => {
    if (!user || planId === "free") return;
    const priceId = planId === "premium" ? "premium_monthly" : "pro_monthly";
    setCheckoutPriceId(priceId);
  };

  const currentTier = profile?.plan_tier || "free";

  return (
    <div className="min-h-screen bg-background pb-24">
      <PaymentTestModeBanner />
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
        <h1 className="text-2xl font-bold text-primary-foreground mb-2">{t("premium.choose_plan")}</h1>
        <p className="text-primary-foreground/80 text-sm max-w-xs mx-auto">{t("premium.grow_business")}</p>
      </div>

      <div className="px-4 -mt-10 relative z-10 space-y-3">
        {plans.map((plan, i) => (
          <motion.div
            key={plan.id}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.1 }}
            className={`relative overflow-hidden rounded-2xl ${
              plan.size === "hero"
                ? "bg-gradient-to-br from-card via-primary/5 to-card shadow-premium-glow ring-2 ring-primary/30 p-6 scale-[1.02]"
                : plan.highlighted
                  ? "bg-card shadow-elevated ring-1 ring-primary/20 p-5"
                  : "bg-card shadow-card p-5"
            }`}
          >
            {plan.badge && (
              <div className={`absolute top-0 right-0 text-primary-foreground text-[10px] font-bold px-3 py-1.5 rounded-bl-xl ${
                plan.size === "hero" ? "gradient-premium" : "gradient-primary"
              }`}>
                {plan.badge}
              </div>
            )}

            {currentTier === plan.id && (
              <div className="absolute top-0 left-0 bg-primary/20 text-primary text-[10px] font-semibold px-3 py-1.5 rounded-br-xl">
                {t("premium.current")}
              </div>
            )}

            <div className={`flex items-baseline gap-2 mb-1 ${plan.size === "hero" ? "mt-2" : ""}`}>
              <h3 className={`font-bold text-foreground ${plan.size === "hero" ? "text-xl" : "text-lg"}`}>
                {plan.name}
              </h3>
            </div>

            <div className="flex items-baseline gap-1 mb-2">
              {plan.price === 0 ? (
                <span className={`font-bold text-foreground ${plan.size === "hero" ? "text-3xl" : "text-2xl"}`}>
                  {t("premium.free")}
                </span>
              ) : (
                <>
                  <span className={`font-bold text-foreground ${plan.size === "hero" ? "text-3xl" : "text-2xl"}`}>
                    ${plan.price}
                  </span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </>
              )}
            </div>

            <p className={`text-xs mb-4 ${plan.id === "free" ? "text-destructive/80" : "text-muted-foreground"}`}>
              {plan.urgency}
            </p>

            <div className={`space-y-2.5 mb-5 ${plan.size === "hero" ? "space-y-3" : ""}`}>
              {plan.features.map((f, j) => (
                <div key={j} className="flex items-center gap-2.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                    plan.size === "hero" ? "bg-primary/15" : plan.highlighted ? "bg-primary/10" : "bg-accent"
                  }`}>
                    <f.icon className={`text-primary ${plan.size === "hero" ? "w-4 h-4" : "w-3.5 h-3.5"}`} />
                  </div>
                  <span className={`text-foreground ${plan.size === "hero" ? "text-sm font-medium" : "text-sm"}`}>
                    {f.text}
                  </span>
                </div>
              ))}
            </div>

            {currentTier === plan.id ? (
              <div className={`w-full rounded-xl bg-accent flex items-center justify-center gap-2 ${plan.size === "hero" ? "h-14" : "h-11"}`}>
                <Check className="w-4 h-4 text-primary" />
                <span className="font-semibold text-primary text-sm">{t("premium.current_plan")}</span>
              </div>
            ) : plan.id === "free" ? (
              <Button disabled className="w-full h-11 rounded-xl bg-muted text-muted-foreground font-semibold text-sm">
                {plan.cta}
              </Button>
            ) : (
              <Button
                onClick={() => handleUpgrade(plan.id)}
                disabled={loading === plan.id}
                className={`w-full rounded-xl font-semibold text-sm hover:opacity-90 transition-all ${
                  plan.size === "hero"
                    ? "h-14 gradient-premium text-primary-foreground shadow-lg shadow-primary/25 animate-pulse-glow"
                    : plan.highlighted
                      ? "h-12 gradient-primary text-primary-foreground"
                      : "h-11 bg-primary/10 text-primary hover:bg-primary/20"
                }`}
              >
                {plan.size === "hero" && <Crown className="w-5 h-5 mr-2" />}
                {loading === plan.id ? t("premium.processing") : plan.cta}
              </Button>
            )}
          </motion.div>
        ))}

        {/* Trust Element */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center py-4 px-4"
        >
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-[280px] mx-auto">
            {t("premium.trust_message")}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center py-2 space-y-1"
        >
          <p className="text-xs text-muted-foreground">{t("premium.free_trial")}</p>
          <p className="text-xs text-muted-foreground">{t("premium.cancel_anytime")}</p>
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

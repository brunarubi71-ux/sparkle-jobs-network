import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Crown, Sparkles, Zap, Shield, Star, Check, TrendingUp, Users, Eye, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import BottomNav from "@/components/BottomNav";
import { toast } from "sonner";
import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";

const plans = [
  {
    id: "free" as const,
    name: "Free",
    price: 0,
    period: "",
    features: [
      { icon: Zap, text: "2 jobs per day" },
      { icon: Users, text: "1 schedule contact" },
      { icon: Percent, text: "10% platform fee" },
    ],
    cta: "Current Plan",
    highlighted: false,
    badge: null,
  },
  {
    id: "premium" as const,
    name: "Premium",
    price: 9.99,
    period: "/month",
    features: [
      { icon: Zap, text: "3 jobs per day" },
      { icon: Users, text: "2 schedule contacts" },
      { icon: Eye, text: "Increased visibility" },
      { icon: Crown, text: "Premium badge" },
      { icon: Percent, text: "10% platform fee" },
    ],
    cta: "Upgrade to Premium",
    highlighted: false,
    badge: null,
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: 19.99,
    period: "/month",
    features: [
      { icon: Zap, text: "Unlimited jobs" },
      { icon: Users, text: "Unlimited schedule contacts" },
      { icon: Percent, text: "Only 5% platform fee" },
      { icon: TrendingUp, text: "Priority access to jobs" },
      { icon: Eye, text: "Boosted visibility" },
      { icon: Star, text: "Early access to high-paying jobs" },
      { icon: Crown, text: "Pro badge" },
    ],
    cta: "Upgrade to Pro",
    highlighted: true,
    badge: "RECOMMENDED",
  },
];

export default function Premium() {
  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const { t } = useLanguage();

  const handleUpgrade = async (planId: "free" | "premium" | "pro") => {
    if (!user || planId === "free") return;
    setLoading(planId);
    try {
      const now = new Date();
      const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      await supabase.from("profiles").update({
        plan_tier: planId,
        is_premium: true,
        premium_status: "trial",
        free_trial_started_at: now.toISOString(),
        free_trial_ends_at: trialEnd.toISOString(),
      }).eq("id", user.id);

      await supabase.from("subscriptions").upsert({
        user_id: user.id,
        status: "trialing",
        trial_start: now.toISOString(),
        trial_end: trialEnd.toISOString(),
        plan_name: planId,
      });

      await refreshProfile();
      toast.success(`${planId === "pro" ? "Pro" : "Premium"} trial started! 🎉`);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(null);
    }
  };

  const currentTier = profile?.plan_tier || "free";

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Hero */}
      <div className="gradient-premium px-6 pt-12 pb-16 text-center relative overflow-hidden">
        <div className="absolute top-4 right-6 opacity-20">
          <Sparkles className="w-20 h-20 text-primary-foreground" />
        </div>
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="w-20 h-20 rounded-full bg-primary-foreground/20 mx-auto flex items-center justify-center mb-4">
          <Crown className="w-10 h-10 text-primary-foreground" />
        </motion.div>
        <h1 className="text-2xl font-bold text-primary-foreground mb-2">Choose Your Plan</h1>
        <p className="text-primary-foreground/80 text-sm max-w-xs mx-auto">
          Grow your cleaning business and earn more
        </p>
      </div>

      <div className="px-4 -mt-8 relative z-10 space-y-4">
        {plans.map((plan, i) => (
          <motion.div
            key={plan.id}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.1 }}
            className={`bg-card rounded-2xl p-5 relative overflow-hidden ${
              plan.highlighted
                ? "shadow-elevated ring-2 ring-primary"
                : "shadow-card"
            }`}
          >
            {plan.badge && (
              <div className="absolute top-0 right-0 gradient-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-bl-xl">
                {plan.badge}
              </div>
            )}

            <div className="flex items-baseline gap-1 mb-1">
              <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
              {currentTier === plan.id && (
                <span className="text-xs text-primary font-medium ml-2">• Current</span>
              )}
            </div>

            <div className="flex items-baseline gap-1 mb-4">
              {plan.price === 0 ? (
                <span className="text-2xl font-bold text-foreground">Free</span>
              ) : (
                <>
                  <span className="text-2xl font-bold text-foreground">${plan.price}</span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </>
              )}
            </div>

            <div className="space-y-2.5 mb-5">
              {plan.features.map((f, j) => (
                <div key={j} className="flex items-center gap-2.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                    plan.highlighted ? "bg-primary/10" : "bg-accent"
                  }`}>
                    <f.icon className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="text-sm text-foreground">{f.text}</span>
                </div>
              ))}
            </div>

            {currentTier === plan.id ? (
              <div className="w-full h-11 rounded-xl bg-accent flex items-center justify-center gap-2">
                <Check className="w-4 h-4 text-primary" />
                <span className="font-semibold text-primary text-sm">Current Plan</span>
              </div>
            ) : plan.id === "free" ? null : (
              <Button
                onClick={() => handleUpgrade(plan.id)}
                disabled={loading === plan.id}
                className={`w-full h-11 rounded-xl font-semibold text-sm hover:opacity-90 transition-all ${
                  plan.highlighted
                    ? "gradient-primary text-primary-foreground animate-pulse-glow"
                    : "bg-primary/10 text-primary hover:bg-primary/20"
                }`}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                {loading === plan.id ? "Processing..." : plan.cta}
              </Button>
            )}
          </motion.div>
        ))}

        {/* Microcopy */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="text-center py-4 space-y-1">
          <p className="text-xs text-muted-foreground">✨ Start with a 7-day free trial</p>
          <p className="text-xs text-muted-foreground">Cancel anytime • No commitment</p>
        </motion.div>
      </div>

      <BottomNav />
    </div>
  );
}

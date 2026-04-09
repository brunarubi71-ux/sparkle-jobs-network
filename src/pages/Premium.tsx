import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Crown, Sparkles, Zap, Shield, Star, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import BottomNav from "@/components/BottomNav";
import { toast } from "sonner";
import { useState } from "react";

const benefits = [
  { icon: Zap, text: "Unlimited job acceptances" },
  { icon: Shield, text: "Unlock all schedule contacts" },
  { icon: Star, text: "Priority visibility" },
  { icon: Crown, text: "Premium badge" },
  { icon: Sparkles, text: "High-priority opportunities" },
];

export default function Premium() {
  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);

  const startTrial = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const now = new Date();
      const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      await supabase.from("profiles").update({
        is_premium: true,
        premium_status: "trial",
        free_trial_started_at: now.toISOString(),
        free_trial_ends_at: trialEnd.toISOString(),
      }).eq("id", user.id);

      await supabase.from("subscriptions").insert({
        user_id: user.id,
        status: "trialing",
        trial_start: now.toISOString(),
        trial_end: trialEnd.toISOString(),
        plan_name: "premium",
      });

      await refreshProfile();
      toast.success("Free trial started! Enjoy unlimited access for 7 days.");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const isPremium = profile?.is_premium;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Hero */}
      <div className="gradient-premium px-6 pt-12 pb-16 text-center relative overflow-hidden">
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
        <h1 className="text-2xl font-bold text-primary-foreground mb-2">
          Earn More. Work Without Limits.
        </h1>
        <p className="text-primary-foreground/80 text-sm max-w-xs mx-auto">
          Unlock unlimited cleaning jobs and all schedule contacts near you.
        </p>
      </div>

      <div className="px-4 -mt-8 relative z-10">
        {/* Pricing card */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-card rounded-2xl shadow-elevated p-6 mb-6"
        >
          <div className="text-center mb-6">
            <p className="text-sm text-muted-foreground mb-1">Start with</p>
            <p className="text-3xl font-bold text-foreground">7-Day Free Trial</p>
            <p className="text-muted-foreground text-sm mt-1">
              Then <span className="font-semibold text-foreground">$19.99</span>/month
            </p>
          </div>

          <div className="space-y-3 mb-6">
            {benefits.map((b, i) => (
              <motion.div
                key={i}
                initial={{ x: -10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                  <b.icon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm text-foreground">{b.text}</span>
              </motion.div>
            ))}
          </div>

          {isPremium ? (
            <div className="w-full h-12 rounded-xl bg-accent flex items-center justify-center gap-2">
              <Check className="w-5 h-5 text-primary" />
              <span className="font-semibold text-primary">You're Premium!</span>
            </div>
          ) : (
            <Button
              onClick={startTrial}
              disabled={loading}
              className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold text-base hover:opacity-90 animate-pulse-glow"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {loading ? "Starting..." : "Start Free Trial"}
            </Button>
          )}
        </motion.div>
      </div>

      <BottomNav />
    </div>
  );
}

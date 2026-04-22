import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { Crown, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import BottomNav from "@/components/BottomNav";
import { useEffect, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import PremiumModal from "@/components/PremiumModal";
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

export default function Premium() {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [history, setHistory] = useState<BillingRow[]>([]);
  const [loading, setLoading] = useState(true);

  const currentTier = (profile?.plan_tier || "free") as "free" | "pro" | "premium";

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

  const tierLabel: Record<string, string> = {
    free: "Free",
    pro: "Pro",
    premium: "Premium",
  };

  const tierPrice: Record<string, string> = {
    free: "$0",
    pro: "$9.99/mo",
    premium: "$19.99/mo",
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <PaymentTestModeBanner />

      {/* Header */}
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
        <h1 className="text-2xl font-bold text-primary-foreground mb-1">My Plan</h1>
        <p className="text-primary-foreground/80 text-sm">Manage your subscription</p>
      </div>

      <div className="px-4 -mt-8 relative z-10 space-y-4">
        {/* Current plan card */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-card rounded-2xl p-6 shadow-elevated"
        >
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
            Current Plan
          </p>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {currentTier !== "free" && <Crown className="w-5 h-5 text-primary" />}
              <h2 className="text-2xl font-bold text-foreground">
                {tierLabel[currentTier]}
              </h2>
            </div>
            <span className="text-lg font-semibold text-muted-foreground">
              {tierPrice[currentTier]}
            </span>
          </div>

          {currentTier === "free" ? (
            <Button
              onClick={() => setShowUpgrade(true)}
              className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold hover:opacity-90"
            >
              <Crown className="w-4 h-4 mr-2" />
              Upgrade
            </Button>
          ) : (
            <div className="flex items-center justify-center gap-2 h-12 rounded-xl bg-accent">
              <Check className="w-4 h-4 text-primary" />
              <span className="font-semibold text-primary text-sm">
                {t("premium.current_plan") || "You're on this plan"}
              </span>
            </div>
          )}
        </motion.div>

        {/* Billing history */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-2xl p-5 shadow-card"
        >
          <h3 className="font-semibold text-foreground mb-3">Billing History</h3>
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-6">Loading...</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No billing history yet
            </p>
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

      <PremiumModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
      <BottomNav />
    </div>
  );
}

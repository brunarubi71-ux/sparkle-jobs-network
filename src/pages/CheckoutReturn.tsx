import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle, ArrowRight, Briefcase, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type CheckoutPurpose = "job_payment" | "wallet_topup" | "subscription";

export default function CheckoutReturn() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const jobId = searchParams.get("job_id");
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { refreshProfile, profile } = useAuth();
  const [activating, setActivating] = useState(!!jobId);

  const purpose: CheckoutPurpose = jobId
    ? "job_payment"
    : searchParams.get("purpose") === "wallet_topup"
    ? "wallet_topup"
    : "subscription";

  const destination =
    purpose === "job_payment"
      ? "/my-jobs"
      : purpose === "wallet_topup"
      ? "/wallet"
      : profile?.role === "owner"
      ? "/post-job"
      : "/jobs";

  useEffect(() => {
    if (!sessionId) return;

    // For job payments, poll until the webhook activates the job (up to 10s)
    if (purpose === "job_payment" && jobId) {
      let attempts = 0;
      const maxAttempts = 5;
      const poll = async () => {
        attempts++;
        const { data } = await supabase
          .from("jobs")
          .select("status")
          .eq("id", jobId)
          .maybeSingle();
        if (data?.status === "open" || attempts >= maxAttempts) {
          setActivating(false);
          return;
        }
        setTimeout(poll, 2000);
      };
      setTimeout(poll, 1500);
    } else {
      // Refresh profile to pick up plan/wallet changes from webhook
      const timer = setTimeout(() => {
        refreshProfile().catch((e) =>
          console.error("[CheckoutReturn] refreshProfile failed:", e)
        );
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [sessionId, purpose, jobId, refreshProfile]);

  const titleKey =
    purpose === "job_payment"
      ? "checkout.job_success_title"
      : purpose === "wallet_topup"
      ? "checkout.wallet_success_title"
      : "checkout.success_title";

  const messageKey =
    purpose === "job_payment"
      ? "checkout.job_success_message"
      : purpose === "wallet_topup"
      ? "checkout.wallet_success_message"
      : "checkout.success_message";

  const ctaLabel =
    purpose === "job_payment"
      ? t("checkout.cta_my_jobs")
      : purpose === "wallet_topup"
      ? t("checkout.cta_wallet")
      : profile?.role === "owner"
      ? t("checkout.cta_post_job")
      : t("checkout.cta_browse_jobs");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center max-w-sm"
      >
        {sessionId ? (
          <>
            <div className="w-20 h-20 rounded-full bg-green-100 mx-auto flex items-center justify-center mb-6">
              {purpose === "job_payment" ? (
                <Briefcase className="w-10 h-10 text-green-600" />
              ) : purpose === "wallet_topup" ? (
                <Wallet className="w-10 h-10 text-green-600" />
              ) : (
                <CheckCircle className="w-10 h-10 text-green-600" />
              )}
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {activating ? t("checkout.activating") : t(titleKey)}
            </h1>
            <p className="text-muted-foreground text-sm mb-6">
              {activating ? t("checkout.activating_desc") : t(messageKey)}
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {t("checkout.no_session")}
            </h1>
            <p className="text-muted-foreground text-sm mb-6">
              {t("checkout.no_session_desc")}
            </p>
          </>
        )}
        <Button
          onClick={() => navigate(destination)}
          disabled={activating}
          className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold"
        >
          {ctaLabel} <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </motion.div>
    </div>
  );
}

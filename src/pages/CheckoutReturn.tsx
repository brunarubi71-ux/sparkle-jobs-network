import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Status = "verifying" | "paid" | "pending" | "failed" | "no_session";

export default function CheckoutReturn() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { refreshProfile, profile } = useAuth();

  const destination = profile?.role === "owner" ? "/my-jobs" : "/jobs";
  const [status, setStatus] = useState<Status>(sessionId ? "verifying" : "no_session");

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    const verify = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("verify-checkout-session", {
          body: { sessionId },
        });
        if (cancelled) return;
        if (error) {
          // Function not deployed or failed: fall back to "pending" rather than fake success.
          setStatus("pending");
          return;
        }
        if (data?.paid) {
          setStatus("paid");
          setTimeout(() => refreshProfile(), 1500);
        } else if (data?.payment_status === "unpaid") {
          setStatus("failed");
        } else {
          setStatus("pending");
        }
      } catch {
        if (!cancelled) setStatus("pending");
      }
    };

    verify();
    return () => { cancelled = true; };
  }, [sessionId, refreshProfile]);

  const Icon = status === "paid"
    ? CheckCircle
    : status === "failed"
      ? AlertCircle
      : Loader2;

  const iconColor = status === "paid"
    ? "text-green-600 bg-green-100"
    : status === "failed"
      ? "text-red-600 bg-red-100"
      : "text-primary bg-primary/10";

  const title =
    status === "paid" ? t("checkout.success_title")
      : status === "failed" ? (t("checkout.failed_title") || "Payment was not completed")
      : status === "no_session" ? t("checkout.no_session")
      : (t("checkout.verifying_title") || "Verifying your payment...");

  const message =
    status === "paid" ? t("checkout.success_message")
      : status === "failed" ? (t("checkout.failed_message") || "Please try again or contact support if you were charged.")
      : status === "no_session" ? t("checkout.no_session_desc")
      : (t("checkout.verifying_message") || "This usually takes a few seconds. You can safely leave this page — we'll update your account when payment confirms.");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center max-w-sm"
      >
        <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-6 ${iconColor}`}>
          <Icon className={`w-10 h-10 ${status === "verifying" ? "animate-spin" : ""}`} />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">{title}</h1>
        <p className="text-muted-foreground text-sm mb-6">{message}</p>
        <Button
          onClick={() => navigate(destination)}
          className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold"
        >
          {profile?.role === "owner" ? "Go to My Jobs" : "Browse Jobs"} <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </motion.div>
    </div>
  );
}

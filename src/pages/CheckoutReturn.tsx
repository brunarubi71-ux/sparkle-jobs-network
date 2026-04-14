import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

export default function CheckoutReturn() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { refreshProfile } = useAuth();

  useEffect(() => {
    // Refresh profile to pick up plan changes from webhook
    if (sessionId) {
      const timer = setTimeout(() => refreshProfile(), 2000);
      return () => clearTimeout(timer);
    }
  }, [sessionId, refreshProfile]);

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
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">{t("checkout.success_title")}</h1>
            <p className="text-muted-foreground text-sm mb-6">{t("checkout.success_message")}</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-foreground mb-2">{t("checkout.no_session")}</h1>
            <p className="text-muted-foreground text-sm mb-6">{t("checkout.no_session_desc")}</p>
          </>
        )}
        <Button
          onClick={() => navigate("/premium")}
          className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> {t("checkout.back_to_plans")}
        </Button>
      </motion.div>
    </div>
  );
}

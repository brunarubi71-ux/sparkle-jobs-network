import { useState } from "react";
import { Landmark, CheckCircle2, RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

interface Props {
  connectAccountId: string | null;
  onboarded: boolean;
  /** Called after successful onboarding redirect so parent can refresh profile */
  onRefresh?: () => void;
}

export function PayoutSetup({ connectAccountId, onboarded, onRefresh }: Props) {
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();

  const handleSetup = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error(t("errors.session_expired") || "Please sign in again"); return; }

      const returnUrl = `${window.location.origin}/earnings`;

      const res = await supabase.functions.invoke("create-connect-account", {
        body: { returnUrl },
      });

      if (res.error) {
        const detail = (res.data as any)?.error || res.error.message;
        throw new Error(detail);
      }

      const url = (res.data as { url?: string })?.url;
      if (!url) throw new Error("No redirect URL returned from Stripe setup.");
      window.location.href = url;
    } catch (err) {
      toast.error((err as Error).message || t("errors.generic"));
    } finally {
      setLoading(false);
    }
  };

  if (onboarded) {
    return (
      <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-emerald-800">{t("payout.connected_title")}</p>
          <p className="text-xs text-emerald-600 mt-0.5">{t("payout.connected_desc")}</p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="text-emerald-700 hover:text-emerald-900 shrink-0"
          onClick={handleSetup}
          disabled={loading}
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : t("payout.update_btn")}
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
          <Landmark className="w-5 h-5 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-900">{t("payout.setup_title")}</p>
          <p className="text-xs text-amber-700 mt-1 leading-relaxed">{t("payout.setup_desc")}</p>
          <Button
            onClick={handleSetup}
            disabled={loading}
            className="mt-3 h-9 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold gap-2"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <ExternalLink className="w-4 h-4" />
            )}
            {loading ? t("payout.opening") : t("payout.connect_btn")}
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { AlertTriangle, CheckCircle, DollarSign, Shield, TrendingUp } from "lucide-react";
import { Dialog, DialogHeader, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useLanguage } from "@/i18n/LanguageContext";

interface JobConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (wantsProUpgrade: boolean) => void;
  loading: boolean;
  jobTitle: string;
  jobPrice: number;
  currentTier: "free" | "premium" | "pro";
}

export default function JobConfirmationModal({ open, onClose, onConfirm, loading, jobTitle, jobPrice, currentTier }: JobConfirmationModalProps) {
  const [wantsUpgrade, setWantsUpgrade] = useState(false);
  const { t } = useLanguage();

  const currentFeeRate = currentTier === "pro" ? 0.05 : 0.10;
  const proFeeRate = 0.05;
  const currentFee = Math.round(jobPrice * currentFeeRate * 100) / 100;
  const currentEarnings = Math.round((jobPrice - currentFee) * 100) / 100;
  const proFee = Math.round(jobPrice * proFeeRate * 100) / 100;
  const proEarnings = Math.round((jobPrice - proFee) * 100) / 100;
  const extraEarnings = Math.round((proEarnings - currentEarnings) * 100) / 100;
  const showUpgrade = currentTier !== "pro";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setWantsUpgrade(false); } }}>
      <DialogPortal>
        <DialogOverlay className="bg-transparent" />
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ backgroundColor: "white", borderRadius: "16px", padding: "24px", width: "100%", maxWidth: "400px", maxHeight: "90vh", overflowY: "auto" }}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-foreground text-center">{t("confirm.title")}</DialogTitle>
            </DialogHeader>

            <p className="text-sm text-muted-foreground text-center">
              {t("confirm.message").replace("this job", `"${jobTitle}"`)}
            </p>

            <div className="bg-accent rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">{t("confirm.earnings_breakdown")}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("confirm.job_price")}</span>
                <span className="text-foreground">${jobPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("confirm.platform_fee")} ({Math.round(currentFeeRate * 100)}%)</span>
                <span className="text-destructive">-${currentFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-border pt-2">
                <span className="font-semibold text-foreground">{t("confirm.earnings")}</span>
                <span className="font-bold text-primary">${currentEarnings.toFixed(2)}</span>
              </div>
            </div>

            {showUpgrade && (
              <div className={`rounded-xl p-4 border-2 transition-all ${wantsUpgrade ? "border-primary bg-primary/5" : "border-border"}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox checked={wantsUpgrade} onCheckedChange={(v) => setWantsUpgrade(!!v)} className="mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      <span className="text-sm font-semibold text-foreground">{t("confirm.upgrade_pro")}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{t("confirm.earn_more")}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-accent rounded-lg p-2 text-center">
                        <p className="text-[10px] text-muted-foreground">{t("confirm.without_pro")}</p>
                        <p className="text-sm font-bold text-foreground">${currentEarnings.toFixed(2)}</p>
                      </div>
                      <div className="bg-primary/10 rounded-lg p-2 text-center ring-1 ring-primary/30">
                        <p className="text-[10px] text-primary font-medium">{t("confirm.with_pro")}</p>
                        <p className="text-sm font-bold text-primary">${proEarnings.toFixed(2)}</p>
                      </div>
                    </div>
                    {extraEarnings > 0 && (
                      <p className="text-xs text-primary font-medium mt-2 text-center">+${extraEarnings.toFixed(2)} {t("confirm.extra_on_job")}</p>
                    )}
                  </div>
                </label>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">{t("confirm.rule1")}</p>
              </div>
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700">{t("confirm.rule2")}</p>
              </div>
            </div>

            <div className="flex gap-3 mt-2">
              <Button variant="outline" onClick={() => { onClose(); setWantsUpgrade(false); }} disabled={loading} className="flex-1 h-11 rounded-xl">
                {t("confirm.cancel")}
              </Button>
              <Button onClick={() => onConfirm(wantsUpgrade)} disabled={loading} className="flex-1 h-11 rounded-xl gradient-primary text-primary-foreground font-semibold hover:opacity-90">
                <CheckCircle className="w-4 h-4 mr-2" />
                {loading ? t("confirm.confirming") : t("confirm.accept")}
              </Button>
            </div>
          </div>
        </div>
      </DialogPortal>
    </Dialog>
  );
}

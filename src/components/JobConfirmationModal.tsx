import { AlertTriangle, CheckCircle, DollarSign, Shield, Users } from "lucide-react";
import { Dialog, DialogHeader, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";

interface JobConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  /** wantsProUpgrade kept for API compatibility — always false now (no upsell). */
  onConfirm: (wantsProUpgrade: boolean) => void;
  loading: boolean;
  jobTitle: string;
  jobPrice: number;
  /** kept for API compatibility — no longer used inside the modal */
  currentTier?: "free" | "premium" | "pro";
  /** Team composition. Defaults to a solo cleaner (1 / 0). */
  cleanersRequired?: number;
  helpersRequired?: number;
}

export default function JobConfirmationModal({
  open,
  onClose,
  onConfirm,
  loading,
  jobTitle,
  jobPrice,
  cleanersRequired = 1,
  helpersRequired = 0,
}: JobConfirmationModalProps) {
  const { t } = useLanguage();

  // Platform takes 10% from the owner; workers split the remaining 90% equally.
  const totalWorkers = Math.max(1, (cleanersRequired ?? 0) + (helpersRequired ?? 0));
  const workerPool = jobPrice * 0.9;
  const yourShare = Math.round((workerPool / totalWorkers) * 100) / 100;
  const isTeamJob = totalWorkers > 1;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogPortal>
        <DialogOverlay className="bg-transparent" />
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ backgroundColor: "white", borderRadius: "16px", padding: "24px", width: "100%", maxWidth: "400px", maxHeight: "90vh", overflowY: "auto" }}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-foreground text-center">{t("confirm.title")}</DialogTitle>
            </DialogHeader>

            <p className="text-sm text-muted-foreground text-center mt-2">
              {t("confirm.message").replace("this job", `"${jobTitle}"`)}
            </p>

            <div className="bg-accent rounded-xl p-4 space-y-2 mt-4">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">You will receive</span>
                <span className="ml-auto text-lg font-bold text-primary">${yourShare.toFixed(2)}</span>
              </div>
              {isTeamJob && (
                <div className="flex items-start gap-2 pt-1">
                  <Users className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Final earnings split equally among all {totalWorkers} hired workers on this team job.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2 mt-4">
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">You must complete this job once accepted.</p>
              </div>
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700">Last-minute cancellations may result in account penalties.</p>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <Button variant="outline" onClick={onClose} disabled={loading} className="flex-1 h-11 rounded-xl">
                Cancel
              </Button>
              <Button onClick={() => onConfirm(false)} disabled={loading} className="flex-1 h-11 rounded-xl gradient-primary text-primary-foreground font-semibold hover:opacity-90">
                <CheckCircle className="w-4 h-4 mr-2" />
                {loading ? t("confirm.confirming") : "Confirm Job"}
              </Button>
            </div>
          </div>
        </div>
      </DialogPortal>
    </Dialog>
  );
}

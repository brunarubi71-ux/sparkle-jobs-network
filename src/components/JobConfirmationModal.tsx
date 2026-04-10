import { useState } from "react";
import { AlertTriangle, CheckCircle, DollarSign, Shield, TrendingUp } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

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
      <DialogContent className="max-w-sm mx-auto rounded-2xl border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground text-center">Confirm Job Acceptance</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground text-center">
          Are you sure you want to accept <span className="font-semibold text-foreground">"{jobTitle}"</span>?
        </p>

        {/* Earnings breakdown */}
        <div className="bg-accent rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Earnings Breakdown</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Job price</span>
            <span className="text-foreground">${jobPrice.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Platform fee ({Math.round(currentFeeRate * 100)}%)</span>
            <span className="text-destructive">-${currentFee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm border-t border-border pt-2">
            <span className="font-semibold text-foreground">You will receive</span>
            <span className="font-bold text-primary">${currentEarnings.toFixed(2)}</span>
          </div>
        </div>

        {/* PRO Upsell */}
        {showUpgrade && (
          <div className={`rounded-xl p-4 border-2 transition-all ${wantsUpgrade ? "border-primary bg-primary/5" : "border-border"}`}>
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox checked={wantsUpgrade} onCheckedChange={(v) => setWantsUpgrade(!!v)} className="mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">Upgrade to PRO — pay only 5%</span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">Earn more on every job</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-accent rounded-lg p-2 text-center">
                    <p className="text-[10px] text-muted-foreground">Without PRO</p>
                    <p className="text-sm font-bold text-foreground">${currentEarnings.toFixed(2)}</p>
                  </div>
                  <div className="bg-primary/10 rounded-lg p-2 text-center ring-1 ring-primary/30">
                    <p className="text-[10px] text-primary font-medium">With PRO</p>
                    <p className="text-sm font-bold text-primary">${proEarnings.toFixed(2)}</p>
                  </div>
                </div>
                {extraEarnings > 0 && (
                  <p className="text-xs text-primary font-medium mt-2 text-center">+${extraEarnings.toFixed(2)} extra on this job alone!</p>
                )}
              </div>
            </label>
          </div>
        )}

        {/* Rules */}
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <Shield className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">You must complete this job once accepted.</p>
          </div>
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700">Last-minute cancellations or no-shows may result in account penalties.</p>
          </div>
        </div>

        <div className="flex gap-3 mt-2">
          <Button variant="outline" onClick={() => { onClose(); setWantsUpgrade(false); }} disabled={loading} className="flex-1 h-11 rounded-xl">
            Cancel
          </Button>
          <Button onClick={() => onConfirm(wantsUpgrade)} disabled={loading} className="flex-1 h-11 rounded-xl gradient-primary text-primary-foreground font-semibold hover:opacity-90">
            <CheckCircle className="w-4 h-4 mr-2" />
            {loading ? "Confirming..." : "Confirm Job"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

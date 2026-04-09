import { AlertTriangle, CheckCircle, DollarSign, Shield } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface JobConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  jobTitle: string;
  jobPrice: number;
}

export default function JobConfirmationModal({ open, onClose, onConfirm, loading, jobTitle, jobPrice }: JobConfirmationModalProps) {
  const platformFee = Math.round(jobPrice * 0.1 * 100) / 100;
  const cleanerEarnings = Math.round((jobPrice - platformFee) * 100) / 100;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
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
            <span className="text-muted-foreground">Platform fee (10%)</span>
            <span className="text-destructive">-${platformFee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm border-t border-border pt-2">
            <span className="font-semibold text-foreground">You will receive</span>
            <span className="font-bold text-primary">${cleanerEarnings.toFixed(2)}</span>
          </div>
        </div>

        {/* Rules */}
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <Shield className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">You must complete this job once accepted.</p>
          </div>
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700">Last-minute cancellations or no-shows may result in account penalties or temporary suspension.</p>
          </div>
        </div>

        <div className="flex gap-3 mt-2">
          <Button variant="outline" onClick={onClose} disabled={loading} className="flex-1 h-11 rounded-xl">
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={loading} className="flex-1 h-11 rounded-xl gradient-primary text-primary-foreground font-semibold hover:opacity-90">
            <CheckCircle className="w-4 h-4 mr-2" />
            {loading ? "Confirming..." : "Confirm Job"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

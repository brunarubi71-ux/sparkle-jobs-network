import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Sparkles, Zap } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  trigger?: "job_limit" | "schedule_limit" | "general";
}

export default function PremiumModal({ open, onClose, title, message }: Props) {
  const navigate = useNavigate();

  const goToPlan = (plan: "pro" | "premium") => {
    onClose();
    navigate(`/premium?plan=${plan}`);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="rounded-3xl max-w-md mx-auto bg-card border-0 shadow-elevated p-6 z-[1000]"
        // Override the overlay's z-index so Leaflet maps (z-index up to 800) never sit above it.
        // Radix renders the overlay as the previous sibling of DialogContent inside the same portal.
        onOpenAutoFocus={(e) => {
          const overlay = document.querySelector<HTMLElement>("[data-radix-dialog-overlay]");
          if (overlay) overlay.style.zIndex = "999";
          e.preventDefault();
        }}
      >
        <DialogHeader className="space-y-2">
          <div className="flex justify-center mb-1">
            <div className="w-14 h-14 rounded-full gradient-primary flex items-center justify-center shadow-card">
              <Crown className="w-7 h-7 text-primary-foreground" />
            </div>
          </div>
          <DialogTitle className="text-center text-2xl font-bold text-foreground">
            {title || "Unlock More Jobs"}
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-muted-foreground">
            {message || "Choose your plan to keep applying"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 mt-4">
          {/* Pro plan */}
          <div className="rounded-2xl border border-border bg-background p-4 flex flex-col">
            <div className="flex items-center gap-1.5 mb-1">
              <Zap className="w-4 h-4 text-primary" />
              <p className="font-bold text-foreground">Pro</p>
            </div>
            <p className="text-lg font-extrabold text-foreground leading-tight">
              $9.99
              <span className="text-xs font-medium text-muted-foreground">/mo</span>
            </p>
            <p className="text-[11px] text-muted-foreground mt-2 mb-4 leading-snug flex-1">
              5 jobs/week, priority access, earn more
            </p>
            <Button
              onClick={() => goToPlan("pro")}
              className="w-full h-9 rounded-xl gradient-primary text-primary-foreground font-semibold text-xs hover:opacity-90"
            >
              Choose Plan
            </Button>
          </div>

          {/* Premium plan */}
          <div className="rounded-2xl border-2 border-primary bg-primary/5 p-4 flex flex-col relative">
            <div className="absolute -top-2 right-3 bg-primary text-primary-foreground text-[9px] font-bold px-2 py-0.5 rounded-full">
              BEST
            </div>
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles className="w-4 h-4 text-primary" />
              <p className="font-bold text-foreground">Premium</p>
            </div>
            <p className="text-lg font-extrabold text-foreground leading-tight">
              $19.99
              <span className="text-xs font-medium text-muted-foreground">/mo</span>
            </p>
            <p className="text-[11px] text-muted-foreground mt-2 mb-4 leading-snug flex-1">
              Unlimited jobs, top listing, badge ⭐
            </p>
            <Button
              onClick={() => goToPlan("premium")}
              className="w-full h-9 rounded-xl gradient-primary text-primary-foreground font-semibold text-xs hover:opacity-90"
            >
              Choose Plan
            </Button>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Maybe Later
        </button>
      </DialogContent>
    </Dialog>
  );
}

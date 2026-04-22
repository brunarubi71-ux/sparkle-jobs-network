import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Sparkles, Zap } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  trigger?: "job_limit" | "schedule_limit" | "general";
}

const proBenefits = [
  { icon: "⚡", text: "5 jobs per week" },
  { icon: "🎯", text: "Priority job access" },
  { icon: "👁️", text: "Increased visibility" },
  { icon: "📅", text: "2 schedule listings" },
];

const premiumBenefits = [
  { icon: "🚀", text: "Unlimited jobs per week" },
  { icon: "⭐", text: "Top profile placement" },
  { icon: "📅", text: "Unlimited schedule listings" },
  { icon: "🏅", text: "Premium badge on profile" },
];

export default function PremiumModal({ open, onClose, title, message }: Props) {
  const navigate = useNavigate();

  const goToPlan = (plan: "pro" | "premium") => {
    onClose();
    navigate(`/premium?plan=${plan}`);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogPortal>
        <DialogOverlay className="fixed inset-0 bg-black/60 z-[999]" />
        <DialogContent
          className="rounded-3xl max-w-md mx-auto bg-card border-0 shadow-elevated p-6 z-[1000]"
          onOpenAutoFocus={(e) => {
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

          {/* Recommendation banner */}
          <div className="mt-4 rounded-2xl gradient-primary px-4 py-3 text-center shadow-card">
            <p className="text-sm font-bold text-primary-foreground">
              ✨ We recommend Pro for you!
            </p>
            <p className="text-[11px] text-primary-foreground/90 mt-0.5">
              Most cleaners on Pro earn 3x more per week
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            {/* Pro plan — RECOMMENDED */}
            <div className="rounded-2xl border-2 border-primary bg-primary/5 p-4 flex flex-col relative shadow-[0_0_20px_hsl(var(--primary)/0.35)] ring-1 ring-primary/30">
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                RECOMMENDED ✓
              </div>
              <div className="flex items-center gap-1.5 mb-1 mt-1">
                <Zap className="w-4 h-4 text-primary" />
                <p className="font-bold text-foreground">Pro</p>
              </div>
              <p className="text-lg font-extrabold text-foreground leading-tight">
                $9.99
                <span className="text-xs font-medium text-muted-foreground">/mo</span>
              </p>
              <ul className="mt-3 mb-4 space-y-1.5 flex-1">
                {proBenefits.map((b) => (
                  <li key={b.text} className="flex items-start gap-1.5 text-[11px] text-foreground leading-snug">
                    <span className="shrink-0">{b.icon}</span>
                    <span>{b.text}</span>
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => goToPlan("pro")}
                className="w-full h-9 rounded-xl gradient-primary text-primary-foreground font-semibold text-xs hover:opacity-90"
              >
                Start with Pro →
              </Button>
            </div>

            {/* Premium plan */}
            <div className="rounded-2xl border border-border bg-background p-4 flex flex-col">
              <div className="flex items-center gap-1.5 mb-1 mt-1">
                <Sparkles className="w-4 h-4 text-primary" />
                <p className="font-bold text-foreground">Premium</p>
              </div>
              <p className="text-lg font-extrabold text-foreground leading-tight">
                $19.99
                <span className="text-xs font-medium text-muted-foreground">/mo</span>
              </p>
              <ul className="mt-3 mb-4 space-y-1.5 flex-1">
                {premiumBenefits.map((b) => (
                  <li key={b.text} className="flex items-start gap-1.5 text-[11px] text-foreground leading-snug">
                    <span className="shrink-0">{b.icon}</span>
                    <span>{b.text}</span>
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => goToPlan("premium")}
                className="w-full h-9 rounded-xl bg-primary/10 text-primary font-semibold text-xs hover:bg-primary/20"
              >
                Go Premium →
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
      </DialogPortal>
    </Dialog>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  trigger?: "job_limit" | "schedule_limit" | "general";
}

export default function PremiumModal({ open, onClose, title, message }: Props) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [selected, setSelected] = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);

  const handleSeeAllPlans = () => {
    onClose();
    navigate("/premium");
  };

  const handleUnlock = () => {
    if (!selected) return;
    setShowCheckout(true);
  };

  const handleClose = () => {
    setShowCheckout(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogPortal>
        <DialogOverlay className="fixed inset-0 bg-black/60 z-[999]" />
        <DialogContent
          className="rounded-3xl max-w-md mx-auto bg-card border-0 shadow-elevated p-6 z-[1000]"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {showCheckout ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-center text-xl font-bold text-foreground">
                  Complete your upgrade
                </DialogTitle>
                <DialogDescription className="text-center text-sm text-muted-foreground">
                  Pro Plan — $14.99/month · 7-day free trial
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 max-h-[70vh] overflow-y-auto">
                <StripeEmbeddedCheckout
                  priceId="pro_monthly"
                  customerEmail={user?.email ?? profile?.email ?? undefined}
                  userId={user?.id}
                  returnUrl={`${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`}
                />
              </div>
            </>
          ) : (
            <>
              <DialogHeader className="space-y-2">
                <DialogTitle className="text-center text-2xl font-bold text-foreground">
                  {title || "You've reached your free limit"}
                </DialogTitle>
                <DialogDescription className="text-center text-sm text-muted-foreground leading-relaxed">
                  {message || "For just $14.99/month you get 5 jobs per week, priority access and increased visibility. Try free for 7 days."}
                </DialogDescription>
              </DialogHeader>

              {/* Single plan tick option */}
              <button
                type="button"
                onClick={() => setSelected((s) => !s)}
                className={`mt-5 w-full flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition-all ${
                  selected
                    ? "border-primary bg-primary/5 shadow-[0_0_20px_hsl(var(--primary)/0.25)]"
                    : "border-border bg-background"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                    selected ? "bg-primary" : "border-2 border-muted-foreground/40"
                  }`}
                >
                  {selected && <Check className="w-4 h-4 text-primary-foreground" strokeWidth={3} />}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-foreground">Pro Plan</p>
                  <p className="text-xs text-muted-foreground">$14.99/month · 7-day free trial · cancel anytime</p>
                </div>
              </button>

              <Button
                onClick={handleUnlock}
                disabled={!selected}
                className="mt-4 w-full h-12 rounded-2xl gradient-primary text-primary-foreground font-bold text-base hover:opacity-90 shadow-card"
              >
                Start 7-day free trial
              </Button>

              <button
                onClick={handleSeeAllPlans}
                className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
              >
                See all plans
              </button>
            </>
          )}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

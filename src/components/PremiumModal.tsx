import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Sparkles, Zap, TrendingUp } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  trigger?: "job_limit" | "schedule_limit" | "general";
}

export default function PremiumModal({ open, onClose, title = "Daily Limit Reached", message, trigger = "general" }: Props) {
  const navigate = useNavigate();

  const defaultMessages: Record<string, string> = {
    job_limit: "You've reached your daily job limit. Upgrade to unlock more jobs and earn more money!",
    schedule_limit: "You've used your schedule contact access. Upgrade to unlock more contacts!",
    general: "Upgrade your plan to unlock more features and grow faster.",
  };

  const displayMessage = message || defaultMessages[trigger];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="rounded-2xl max-w-sm mx-auto">
        <DialogHeader>
          <div className="flex justify-center mb-3">
            <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center">
              <Crown className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl">{title}</DialogTitle>
        </DialogHeader>
        <p className="text-center text-muted-foreground text-sm mb-4">{displayMessage}</p>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <Zap className="w-4 h-4 text-primary" /> <span>Unlock more jobs daily</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-foreground">
            <TrendingUp className="w-4 h-4 text-primary" /> <span>Earn more money</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-foreground">
            <Crown className="w-4 h-4 text-primary" /> <span>Get priority access</span>
          </div>
        </div>

        <Button
          onClick={() => { onClose(); navigate("/premium"); }}
          className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold hover:opacity-90"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          View Plans
        </Button>
      </DialogContent>
    </Dialog>
  );
}

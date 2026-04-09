import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Sparkles } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
}

export default function PremiumModal({ open, onClose, title = "Daily Limit Reached", message = "You've reached your daily limit." }: Props) {
  const navigate = useNavigate();

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
        <p className="text-center text-muted-foreground text-sm mb-4">{message}</p>
        <p className="text-center text-sm text-foreground font-medium mb-4">
          Start your 7-day free trial to unlock unlimited access.
        </p>
        <Button
          onClick={() => { onClose(); navigate("/premium"); }}
          className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold hover:opacity-90"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Start Free Trial
        </Button>
      </DialogContent>
    </Dialog>
  );
}

import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Sparkles, Zap, TrendingUp } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  trigger?: "job_limit" | "schedule_limit" | "general";
}

export default function PremiumModal({ open, onClose, title, message, trigger = "general" }: Props) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const displayTitle = title || t("premium.daily_limit");

  const defaultMessages: Record<string, string> = {
    job_limit: t("premium.job_limit_msg"),
    schedule_limit: t("premium.schedule_limit_msg"),
    general: t("premium.general_msg"),
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
          <DialogTitle className="text-center text-xl">{displayTitle}</DialogTitle>
        </DialogHeader>
        <p className="text-center text-muted-foreground text-sm mb-4">{displayMessage}</p>
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-foreground"><Zap className="w-4 h-4 text-primary" /> <span>{t("premium.unlock_jobs")}</span></div>
          <div className="flex items-center gap-2 text-sm text-foreground"><TrendingUp className="w-4 h-4 text-primary" /> <span>{t("premium.earn_more")}</span></div>
          <div className="flex items-center gap-2 text-sm text-foreground"><Crown className="w-4 h-4 text-primary" /> <span>{t("premium.priority_access")}</span></div>
        </div>
        <Button onClick={() => { onClose(); navigate("/premium"); }}
          className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold hover:opacity-90">
          <Sparkles className="w-4 h-4 mr-2" /> {t("premium.view_plans")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

interface DisputeModalProps {
  open: boolean;
  onClose: () => void;
  jobId: string;
  reportedId: string;
}

export default function DisputeModal({ open, onClose, jobId, reportedId }: DisputeModalProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim() || !user) return;
    setSubmitting(true);

    const { error } = await supabase.from("disputes").insert({
      job_id: jobId,
      reporter_id: user.id,
      reported_id: reportedId,
      reporter_type: "owner",
      reason: reason.trim(),
    } as any);

    if (error) {
      toast.error(t("dispute.error"));
    } else {
      // Put job in disputed status
      await supabase.from("jobs").update({ escrow_status: "disputed" } as any).eq("id", jobId);
      toast.success(t("dispute.submitted"));
      onClose();
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            {t("dispute.title")}
          </DialogTitle>
          <DialogDescription>{t("dispute.description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>{t("dispute.reason_label")}</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("dispute.reason_placeholder")}
              className="mt-1.5 min-h-[120px]"
              maxLength={1000}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl">
              {t("dispute.cancel")}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!reason.trim() || submitting}
              className="flex-1 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submitting ? t("dispute.submitting") : t("dispute.submit")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

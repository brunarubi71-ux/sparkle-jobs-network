import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { awardPoints } from "@/lib/points";
import { sendNotification } from "@/lib/notifications";

interface Props {
  open: boolean;
  onClose: () => void;
  jobId: string;
  reviewedId: string;
}

export default function ReviewModal({ open, onClose, jobId, reviewedId }: Props) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { error: insertError } = await supabase.from("reviews").insert({
        job_id: jobId,
        reviewer_id: user.id,
        reviewed_id: reviewedId,
        rating,
        review_text: text || null,
      } as any);
      if (insertError) throw insertError;

      let reviewerName = "Someone";
      try {
        const { data: reviewerProfile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();
        reviewerName = (reviewerProfile as any)?.full_name || "Someone";
      } catch {}

      await sendNotification({
        userId: reviewedId,
        title: "New Review ⭐",
        message: `${reviewerName} left you a ${rating}-star review!`,
        type: "new_review",
        relatedId: jobId,
        link: `/profile/${reviewedId}`,
      });

      try {
        const { data: reviewedProfile } = await supabase
          .from("profiles")
          .select("role, worker_type, points")
          .eq("id", reviewedId)
          .maybeSingle();
        const reviewedRole = (reviewedProfile as any)?.role;
        const reviewedWorkerType = (reviewedProfile as any)?.worker_type;
        if (reviewedRole === "owner") {
          await awardPoints(user.id, "review_given_owner");
        } else if (reviewedWorkerType === "helper") {
          await awardPoints(user.id, "review_given_helper");
        } else {
          await awardPoints(user.id, "review_given_cleaner");
        }
        if (rating === 5 && reviewedRole !== "owner") {
          await awardPoints(reviewedId, "received_5_star");
        }
      } catch {}

      toast.success(t("review.success"));
      onClose();
    } catch {
      toast.error(t("review.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="rounded-2xl max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="text-center">{t("review.modal_title")}</DialogTitle>
        </DialogHeader>
        <div className="flex justify-center gap-2 my-4">
          {[1, 2, 3, 4, 5].map((s) => (
            <button key={s} onClick={() => setRating(s)} className="transition-transform hover:scale-110">
              <Star className={`w-8 h-8 ${s <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
            </button>
          ))}
        </div>
        <Textarea
          placeholder={t("review.placeholder")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="rounded-xl"
        />
        <Button onClick={submit} disabled={loading} className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold">
          {loading ? t("review.submitting") : t("review.submit")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

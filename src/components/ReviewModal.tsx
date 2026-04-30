import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await supabase.from("reviews").insert({
        job_id: jobId,
        reviewer_id: user.id,
        reviewed_id: reviewedId,
        rating,
        review_text: text || null,
      });

      // Lookup reviewer name + reviewed person's role for points + notification
      let reviewerName = "Someone";
      try {
        const { data: reviewerProfile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();
        reviewerName = (reviewerProfile as any)?.full_name || "Someone";
      } catch {}

      // Notify the reviewed user about the new review
      await sendNotification({
        userId: reviewedId,
        title: "New Review ⭐",
        message: `${reviewerName} left you a ${rating}-star review!`,
        type: "new_review",
        relatedId: jobId,
        link: `/profile/${reviewedId}`,
      });

      // Award points to the reviewer (depends on the role of the person being reviewed)
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
        // Bonus for the reviewed person if they got 5 stars (and they are a worker)
        if (rating === 5 && reviewedRole !== "owner") {
          await awardPoints(reviewedId, "received_5_star");
        }
      } catch {}

      toast.success("Review submitted!");
      onClose();
    } catch {
      toast.error("Failed to submit review");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="rounded-2xl max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="text-center">Rate your experience</DialogTitle>
        </DialogHeader>
        <div className="flex justify-center gap-2 my-4">
          {[1, 2, 3, 4, 5].map((s) => (
            <button key={s} onClick={() => setRating(s)} className="transition-transform hover:scale-110">
              <Star className={`w-8 h-8 ${s <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
            </button>
          ))}
        </div>
        <Textarea placeholder="Write a review (optional)" value={text} onChange={(e) => setText(e.target.value)} className="rounded-xl" />
        <Button onClick={submit} disabled={loading} className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold">
          {loading ? "Submitting..." : "Submit Review"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

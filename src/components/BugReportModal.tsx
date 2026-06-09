import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bug, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CATEGORIES = [
  { value: "bug",     label: "Bug / something not working" },
  { value: "payment", label: "Payment issue" },
  { value: "account", label: "Account / profile issue" },
  { value: "other",   label: "Other" },
];

export default function BugReportModal({ open, onOpenChange }: Props) {
  const { user, profile } = useAuth();
  const [category, setCategory] = useState("bug");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleClose = (v: boolean) => {
    if (!v) {
      setDescription("");
      setCategory("bug");
      setSent(false);
    }
    onOpenChange(v);
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast.error("Please describe the problem.");
      return;
    }
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await (supabase.from as any)("bug_reports").insert({
        user_id: user.id,
        user_email: user.email ?? (profile as any)?.email ?? null,
        category,
        description: description.trim(),
        page_url: window.location.pathname,
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      console.error("[BugReportModal]", err);
      toast.error("Failed to send report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="rounded-2xl max-w-sm mx-4">
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>
            <DialogTitle className="text-base font-bold">Report sent!</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Thank you. We'll look into this and fix it as soon as possible.
            </p>
            <Button className="mt-2 w-full rounded-xl" onClick={() => handleClose(false)}>
              Close
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader className="text-center items-center pb-1">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-1">
                <Bug className="w-6 h-6 text-primary" />
              </div>
              <DialogTitle className="text-base font-bold">Report a problem</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Tell us what went wrong and we'll fix it quickly.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-1">
              <div>
                <p className="text-xs font-medium text-foreground mb-1.5">Category</p>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="rounded-xl h-10 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="text-xs font-medium text-foreground mb-1.5">What happened?</p>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the problem in as much detail as possible..."
                  rows={4}
                  maxLength={1000}
                  className="rounded-xl text-sm resize-none"
                />
                <p className="text-[10px] text-muted-foreground text-right mt-1">
                  {description.length}/1000
                </p>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={loading || !description.trim()}
                className="w-full rounded-xl h-11 font-semibold"
              >
                {loading ? "Sending…" : "Send report"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

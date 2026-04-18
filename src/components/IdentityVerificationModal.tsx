import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Upload, Camera, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface IdentityVerificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted?: () => void;
}

export default function IdentityVerificationModal({ open, onOpenChange, onSubmitted }: IdentityVerificationModalProps) {
  const { user, refreshProfile } = useAuth();
  const [docFile, setDocFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const reset = () => {
    setDocFile(null);
    setSelfieFile(null);
    setSubmitted(false);
  };

  const handleClose = (val: boolean) => {
    if (!val) reset();
    onOpenChange(val);
  };

  const uploadFile = async (file: File, kind: "document" | "selfie") => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user!.id}/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("identity-docs").upload(path, file, { upsert: true });
    if (error) throw error;
    return path;
  };

  const handleSubmit = async () => {
    if (!user || !docFile || !selfieFile) return;
    setSubmitting(true);
    try {
      const [docPath, selfiePath] = await Promise.all([
        uploadFile(docFile, "document"),
        uploadFile(selfieFile, "selfie"),
      ]);
      const { error } = await supabase
        .from("profiles")
        .update({
          identity_status: "pending",
          identity_document_url: docPath,
          identity_selfie_url: selfiePath,
          identity_submitted_at: new Date().toISOString(),
        } as any)
        .eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      setSubmitted(true);
      onSubmitted?.();
    } catch (err) {
      console.error("[IdentityVerification] submit error:", err);
      toast.error("Failed to submit documents. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <DialogTitle className="text-foreground">Verify Your Identity</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Required before applying to jobs</p>
            </div>
          </div>
        </DialogHeader>

        {submitted ? (
          <div className="py-6 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-100 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-foreground">Documents submitted!</p>
            <p className="text-xs text-muted-foreground px-4">
              Your documents are under review. You'll be notified within 24 hours.
            </p>
            <Button onClick={() => handleClose(false)} className="w-full rounded-xl mt-4">Close</Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              Upload a clear photo of your ID document and a selfie holding it. Accepted: ID, Driver's License, or Passport.
            </p>

            {/* Document upload */}
            <label className="block">
              <span className="text-xs font-medium text-foreground mb-1.5 block">Document Photo</span>
              <div className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${docFile ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
                <Upload className={`w-5 h-5 mx-auto mb-1.5 ${docFile ? "text-primary" : "text-muted-foreground"}`} />
                <p className="text-xs font-medium text-foreground">{docFile ? docFile.name : "Upload Document"}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{docFile ? "Tap to replace" : "ID, License or Passport"}</p>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setDocFile(e.target.files?.[0] || null)} />
              </div>
            </label>

            {/* Selfie upload */}
            <label className="block">
              <span className="text-xs font-medium text-foreground mb-1.5 block">Selfie with Document</span>
              <div className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${selfieFile ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
                <Camera className={`w-5 h-5 mx-auto mb-1.5 ${selfieFile ? "text-primary" : "text-muted-foreground"}`} />
                <p className="text-xs font-medium text-foreground">{selfieFile ? selfieFile.name : "Take Selfie"}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{selfieFile ? "Tap to replace" : "Hold your ID next to your face"}</p>
                <input type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => setSelfieFile(e.target.files?.[0] || null)} />
              </div>
            </label>

            <Button
              onClick={handleSubmit}
              disabled={!docFile || !selfieFile || submitting}
              className="w-full h-11 rounded-xl gradient-primary text-primary-foreground"
            >
              {submitting ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>) : "Submit for Review"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

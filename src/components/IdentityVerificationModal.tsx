import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Upload, Camera, CheckCircle2, Loader2, FileText, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

interface IdentityVerificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted?: () => void;
}

export default function IdentityVerificationModal({ open, onOpenChange, onSubmitted }: IdentityVerificationModalProps) {
  const { user, profile, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const isOwner = profile?.role === "owner";

  const [docFile, setDocFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [addressFile, setAddressFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const reset = () => {
    setDocFile(null);
    setSelfieFile(null);
    setAddressFile(null);
    setSubmitted(false);
  };

  const handleClose = (val: boolean) => {
    if (!val) reset();
    onOpenChange(val);
  };

  const validateFileSize = (file: File): boolean => {
    if (file.size > MAX_FILE_SIZE) {
      toast.error(t("identity.file_too_large"));
      return false;
    }
    return true;
  };

  const handleFileChange = (setter: (f: File | null) => void) => (file: File | null) => {
    if (file && !validateFileSize(file)) return;
    setter(file);
  };

  const uploadFile = async (file: File, kind: string) => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user!.id}/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("identity-docs").upload(path, file, { upsert: true });
    if (error) throw error;
    return path;
  };

  const allReady = isOwner
    ? !!(docFile && addressFile && selfieFile)
    : !!(docFile && selfieFile);

  const handleSubmit = async () => {
    if (!user || !allReady) return;
    setSubmitting(true);
    try {
      const uploads: Promise<string>[] = [
        uploadFile(docFile!, "document"),
        uploadFile(selfieFile!, "selfie"),
      ];
      if (isOwner) uploads.push(uploadFile(addressFile!, "address"));

      const results = await Promise.all(uploads);
      const docPath = results[0];
      const selfiePath = results[1];
      const addressPath = isOwner ? results[2] : null;

      const updatePayload: any = {
        identity_status: "pending",
        identity_document_url: docPath,
        identity_selfie_url: selfiePath,
        identity_submitted_at: new Date().toISOString(),
      };
      if (isOwner) updatePayload.identity_address_proof_url = addressPath;

      const { error } = await supabase
        .from("profiles")
        .update(updatePayload)
        .eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      setSubmitted(true);
      onSubmitted?.();
      setTimeout(() => handleClose(false), 2500);
    } catch (err: any) {
      console.error("[IdentityVerification] submit error:", err);
      toast.error(err?.message || "Failed to submit documents. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      {open && (
        <style>{`[data-radix-dialog-overlay]{z-index:99998 !important;}`}</style>
      )}
      <DialogContent
        className="max-w-md rounded-2xl max-h-[90vh] overflow-y-auto"
        style={{ zIndex: 99999, position: "fixed" }}
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <DialogTitle className="text-foreground">{t("identity.title")}</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isOwner ? t("identity.subtitle_owner") : t("identity.subtitle_cleaner")}
              </p>
            </div>
          </div>
        </DialogHeader>

        {submitted ? (
          <div className="py-6 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-100 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-foreground">{t("identity.submitted_title")}</p>
            <p className="text-xs text-muted-foreground px-4">
              {t("identity.submitted_body")}
            </p>
            <Button onClick={() => handleClose(false)} className="w-full rounded-xl mt-4">{t("identity.close")}</Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              {isOwner ? t("identity.intro_owner") : t("identity.intro_cleaner")}
            </p>

            <UploadField
              icon={isOwner ? FileText : Upload}
              label={isOwner ? t("identity.id_label_owner") : t("identity.id_label_cleaner")}
              hint={t("identity.id_hint")}
              file={docFile}
              onChange={handleFileChange(setDocFile)}
              tapUpload={t("identity.tap_upload")}
              tapReplace={t("identity.tap_replace")}
            />

            {isOwner && (
              <UploadField
                icon={Home}
                label={t("identity.address_label")}
                hint={t("identity.address_hint")}
                file={addressFile}
                onChange={handleFileChange(setAddressFile)}
                tapUpload={t("identity.tap_upload")}
                tapReplace={t("identity.tap_replace")}
              />
            )}

            <UploadField
              icon={Camera}
              label={isOwner ? t("identity.selfie_label_owner") : t("identity.selfie_label_cleaner")}
              hint={t("identity.selfie_hint")}
              file={selfieFile}
              onChange={handleFileChange(setSelfieFile)}
              tapUpload={t("identity.tap_upload")}
              tapReplace={t("identity.tap_replace")}
              capture
            />

            <Button
              onClick={handleSubmit}
              disabled={!allReady || submitting}
              className="w-full h-11 rounded-xl gradient-primary text-primary-foreground"
            >
              {submitting ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("identity.uploading")}</>) : t("identity.submit")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function UploadField({
  icon: Icon, label, hint, file, onChange, capture, tapUpload, tapReplace,
}: {
  icon: any;
  label: string;
  hint: string;
  file: File | null;
  onChange: (f: File | null) => void;
  capture?: boolean;
  tapUpload: string;
  tapReplace: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-foreground mb-1.5 block">{label}</span>
      <div className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${file ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
        <Icon className={`w-5 h-5 mx-auto mb-1.5 ${file ? "text-primary" : "text-muted-foreground"}`} />
        <p className="text-xs font-medium text-foreground">{file ? file.name : tapUpload}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{file ? tapReplace : hint}</p>
        <input
          type="file"
          accept="image/*"
          {...(capture ? { capture: "user" as any } : {})}
          className="hidden"
          onChange={(e) => onChange(e.target.files?.[0] || null)}
        />
      </div>
    </label>
  );
}

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function ChangePasswordModal({ open, onOpenChange }: Props) {
  const { t } = useLanguage();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrent(false);
    setShowNew(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error(t("profile.password_too_short") || "Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t("profile.passwords_dont_match") || "New passwords don't match");
      return;
    }

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email;
      if (!email) throw new Error("Not signed in");

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (signInErr) {
        toast.error(t("profile.current_password_wrong") || "Current password is incorrect");
        setSaving(false);
        return;
      }

      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updateErr) throw updateErr;

      toast.success(t("profile.password_changed") || "Password changed successfully");
      reset();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            {t("profile.change_password") || "Change password"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              {t("profile.current_password") || "Current password"}
            </label>
            <div className="relative">
              <Input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="pr-10"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              {t("profile.new_password") || "New password"}
            </label>
            <div className="relative">
              <Input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {t("profile.password_min") || "At least 8 characters"}
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              {t("profile.confirm_new_password") || "Confirm new password"}
            </label>
            <Input
              type={showNew ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              {t("common.cancel") || "Cancel"}
            </Button>
            <Button type="submit" className="flex-1 gradient-primary text-white" disabled={saving}>
              {saving ? "..." : t("profile.save") || "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

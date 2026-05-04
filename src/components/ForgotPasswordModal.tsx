import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, KeyRound } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultEmail?: string;
}

export default function ForgotPasswordModal({ open, onOpenChange, defaultEmail = "" }: Props) {
  const { t } = useLanguage();
  const [email, setEmail] = useState(defaultEmail);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const reset = () => {
    setEmail(defaultEmail);
    setSending(false);
    setSent(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    setSending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success(t("auth.reset_email_sent") || "Reset email sent");
    } catch (err: any) {
      toast.error(err.message || "Failed to send reset email");
    } finally {
      setSending(false);
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
            {t("auth.forgot_password_title") || "Reset your password"}
          </DialogTitle>
        </DialogHeader>

        {sent ? (
          <div className="space-y-4 mt-2">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/10">
              <Mail className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div className="text-sm text-foreground">
                {t("auth.reset_email_sent_body") ||
                  "If an account exists for that email, a reset link has been sent. Check your inbox (and spam folder)."}
              </div>
            </div>
            <Button
              type="button"
              className="w-full gradient-primary text-white"
              onClick={() => onOpenChange(false)}
            >
              {t("common.ok") || "OK"}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              {t("auth.forgot_password_help") ||
                "Enter your email and we'll send you a link to reset your password."}
            </p>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                {t("auth.email") || "Email"}
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
                disabled={sending}
              >
                {t("common.cancel") || "Cancel"}
              </Button>
              <Button
                type="submit"
                className="flex-1 gradient-primary text-white"
                disabled={sending || !email.trim()}
              >
                {sending ? "..." : t("auth.send_reset_link") || "Send reset link"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

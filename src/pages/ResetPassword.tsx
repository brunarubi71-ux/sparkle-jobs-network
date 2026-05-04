import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import logoImg from "@/assets/shinely-logo.png";

export default function ResetPassword() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setHasRecoverySession(!!data.session);
      setReady(true);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasRecoverySession(!!session);
        setReady(true);
      }
    });

    check();

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error(t("profile.password_too_short") || "Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      toast.error(t("profile.passwords_dont_match") || "Passwords don't match");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      toast.success(t("auth.password_reset_success") || "Password updated. Please log in.");
      await supabase.auth.signOut();
      setTimeout(() => navigate("/auth", { replace: true }), 1500);
    } catch (err: any) {
      toast.error(err.message || "Failed to update password");
    } finally {
      setSaving(false);
    }
  };

  if (!ready) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 sm:p-8">
        <div className="flex flex-col items-center mb-6">
          <img src={logoImg} alt="Shinely" className="w-16 h-16 mb-3" />
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            {t("auth.reset_password_title") || "Reset your password"}
          </h1>
        </div>

        {!hasRecoverySession ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 text-center">
              {t("auth.reset_link_invalid") ||
                "This reset link is invalid or has expired. Please request a new one."}
            </p>
            <Button
              type="button"
              className="w-full gradient-primary text-white"
              onClick={() => navigate("/auth", { replace: true })}
            >
              {t("auth.back_to_login") || "Back to login"}
            </Button>
          </div>
        ) : done ? (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
            <p className="text-sm text-gray-700">
              {t("auth.password_reset_success") || "Password updated. Redirecting to login..."}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                {t("auth.new_password") || "New password"}
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                {t("profile.password_min") || "At least 8 characters"}
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                {t("auth.confirm_new_password") || "Confirm new password"}
              </label>
              <Input
                type={showPassword ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 gradient-primary text-white font-semibold"
              disabled={saving}
            >
              {saving ? "..." : t("auth.update_password") || "Update password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

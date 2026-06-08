import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { Briefcase, User, Car, UserMinus, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import TermsModal from "@/components/TermsModal";
import { Checkbox } from "@/components/ui/checkbox";
import logoImg from "@/assets/shinely-logo.png";

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"cleaner" | "owner">("cleaner");
  const [hasTransportation, setHasTransportation] = useState(true);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const { signUp, signIn, isPasswordRecovery, clearPasswordRecovery } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isSignUp) {
        await signUp(email, password, fullName, role, role === "cleaner" ? hasTransportation : undefined);
        // Owners go to post-job, cleaners/helpers to home
        navigate(role === "owner" ? "/post-job" : "/", { replace: true });
      } else {
        await signIn(email, password);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
          const r = (prof?.role as string) || "cleaner";
          if (r === "admin") return navigate("/admin", { replace: true });
          if (r === "owner") return navigate("/post-job", { replace: true });
        }
        navigate("/", { replace: true });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Digite seu email acima primeiro");
      return;
    }
    setResetLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      setResetEmailSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setResetLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    setError("");
    if (newPassword.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordUpdated(true);
      clearPasswordRecovery();
      setTimeout(() => navigate("/", { replace: true }), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) setError(t("common.google_failed"));
  };

  const stars = [
    { top: "8%", left: "10%", size: 14, opacity: 0.5 },
    { top: "18%", right: "12%", size: 10, opacity: 0.35 },
    { top: "42%", left: "6%", size: 18, opacity: 0.4 },
    { bottom: "22%", right: "8%", size: 12, opacity: 0.55 },
    { bottom: "10%", left: "14%", size: 8, opacity: 0.3 },
    { top: "30%", right: "18%", size: 6, opacity: 0.6 },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-4 py-8">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(145deg, #4C1D95 0%, #7C3AED 35%, #A855F7 60%, #9333EA 80%, #6D28D9 100%)",
        }}
      />

      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute z-0 select-none pointer-events-none text-white"
          style={{
            top: s.top as any,
            left: (s as any).left,
            right: (s as any).right,
            bottom: (s as any).bottom,
            fontSize: `${s.size}px`,
            opacity: s.opacity,
            lineHeight: 1,
          }}
        >
          ✦
        </span>
      ))}

      <div className="absolute top-4 right-4 z-20">
        <LanguageSwitcher />
      </div>

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 flex flex-col items-center mb-8"
      >
        <img
          src={logoImg}
          alt="Shinely"
          style={{ height: "100px", width: "auto", maxWidth: "280px", objectFit: "contain", filter: "brightness(0) invert(1)", opacity: 1 }}
        />
        <p
          className="mt-3 text-white"
          style={{ fontSize: "11px", letterSpacing: "2px", opacity: 0.7, fontWeight: 400 }}
        >
          {t("auth.slogan")}
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="relative z-10 w-full max-w-sm bg-white shadow-[0_16px_48px_-12px_rgba(0,0,0,0.25)] px-7 pb-7"
        style={{ borderRadius: "28px", paddingTop: "28px" }}
      >
        <h2 className="text-xl font-bold text-gray-900 mb-1">
          {isPasswordRecovery ? "Definir nova senha" : showForgotPassword ? (resetEmailSent ? "Email enviado!" : "Esqueceu a senha?") : isSignUp ? t("auth.create_account") : t("auth.welcome")}
        </h2>
        {!showForgotPassword && !isPasswordRecovery && <p className="text-sm text-gray-500 mb-6">
          {isSignUp ? t("auth.tagline") : t("auth.sign_in_continue")}
        </p>}

        {isPasswordRecovery && (
          <div className="space-y-4 mt-4">
            {passwordUpdated ? (
              <div className="text-center py-4">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-gray-800 mb-1">Senha atualizada!</p>
                <p className="text-xs text-gray-500">Redirecionando...</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-500">Digite e confirme sua nova senha.</p>
                <div className="relative">
                  <Input
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Nova senha"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={8}
                    className="rounded-xl h-12 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-primary focus:ring-primary pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <Input
                  type="password"
                  placeholder="Confirmar nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={8}
                  className="rounded-xl h-12 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-primary focus:ring-primary"
                />
                {error && <p className="text-sm text-destructive font-medium">{error}</p>}
                <Button
                  type="button"
                  onClick={handleUpdatePassword}
                  disabled={loading}
                  className="w-full h-12 rounded-xl gradient-primary text-white font-semibold text-base shadow-[0_4px_14px_0_hsla(271,91%,65%,0.4)] hover:opacity-95 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? "..." : "Salvar nova senha"}
                </Button>
              </>
            )}
          </div>
        )}

        {!isPasswordRecovery && showForgotPassword && (
          <div className="space-y-4 mt-6">
            {resetEmailSent ? (
              <div className="text-center py-4">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-gray-800 mb-1">Email enviado!</p>
                <p className="text-xs text-gray-500 mb-4">
                  Enviamos um link para <strong>{email}</strong>. Verifique sua caixa de entrada.
                </p>
                <button
                  type="button"
                  onClick={() => { setShowForgotPassword(false); setResetEmailSent(false); }}
                  className="text-sm text-primary font-semibold hover:underline"
                >
                  ← Voltar para login
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-500 -mt-2">
                  Digite seu email e enviaremos um link para redefinir sua senha.
                </p>
                <Input
                  type="email"
                  placeholder={t("auth.email")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-xl h-12 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-primary focus:ring-primary"
                />
                {error && <p className="text-sm text-destructive font-medium">{error}</p>}
                <Button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetLoading}
                  className="w-full h-12 rounded-xl gradient-primary text-white font-semibold text-base shadow-[0_4px_14px_0_hsla(271,91%,65%,0.4)] hover:opacity-95 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {resetLoading ? "..." : "Enviar link de redefinição"}
                </Button>
                <button
                  type="button"
                  onClick={() => { setShowForgotPassword(false); setError(""); }}
                  className="w-full text-center text-sm text-gray-500 hover:text-gray-700 py-1"
                >
                  ← Voltar para login
                </button>
              </>
            )}
          </div>
        )}
        <form onSubmit={handleSubmit} className={`space-y-4${showForgotPassword || isPasswordRecovery ? " hidden" : ""}`}>
          {isSignUp && (
            <>
              <Input
                placeholder={t("auth.full_name")}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="rounded-xl h-12 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-primary focus:ring-primary"
              />
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole("cleaner")}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    role === "cleaner"
                      ? "border-primary bg-primary/5"
                      : "border-gray-200 hover:border-primary/40"
                  }`}
                >
                  <Briefcase className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium text-gray-800">{t("auth.cleaner")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRole("owner")}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    role === "owner"
                      ? "border-primary bg-primary/5"
                      : "border-gray-200 hover:border-primary/40"
                  }`}
                >
                  <User className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium text-gray-800">{t("auth.owner")}</span>
                </button>
              </div>

              {role === "cleaner" && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    {t("auth.transportation_question") || "Do you have your own transportation?"}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setHasTransportation(true)}
                      className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                        hasTransportation
                          ? "border-primary bg-primary/5"
                          : "border-gray-200 hover:border-primary/40"
                      }`}
                    >
                      <Car className="w-5 h-5 text-primary" />
                      <span className="text-sm font-medium text-gray-800">{t("auth.yes_transport") || "Yes"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setHasTransportation(false)}
                      className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                        !hasTransportation
                          ? "border-primary bg-primary/5"
                          : "border-gray-200 hover:border-primary/40"
                      }`}
                    >
                      <UserMinus className="w-5 h-5 text-primary" />
                      <span className="text-sm font-medium text-gray-800">{t("auth.no_transport") || "No (Helper)"}</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          <Input
            type="email"
            placeholder={t("auth.email")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="rounded-xl h-12 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-primary focus:ring-primary"
          />
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder={t("auth.password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="rounded-xl h-12 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-primary focus:ring-primary pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          {!isSignUp && (
            <div className="text-right">
              <button type="button" onClick={() => { setShowForgotPassword(true); setError(""); }} className="text-xs text-primary font-medium hover:underline">
                {t("auth.forgot_password")}
              </button>
            </div>
          )}

          {isSignUp && (
            <div className="flex items-start gap-2">
              <Checkbox
                id="terms"
                checked={acceptedTerms}
                onCheckedChange={(c) => setAcceptedTerms(c === true)}
                className="mt-0.5"
              />
              <label htmlFor="terms" className="text-xs text-gray-600 leading-relaxed cursor-pointer">
                {t("auth.agree_to")}{" "}
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); setTermsOpen(true); }}
                  className="text-primary font-semibold hover:underline"
                >
                  {t("auth.terms_of_service")}
                </button>{" "}
                {t("auth.and")}{" "}
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); setTermsOpen(true); }}
                  className="text-primary font-semibold hover:underline"
                >
                  {t("auth.privacy_policy")}
                </button>
              </label>
            </div>
          )}

          {error && <p className="text-sm text-destructive font-medium">{error}</p>}

          <Button
            type="submit"
            disabled={loading || (isSignUp && !acceptedTerms)}
            className="w-full h-12 rounded-xl gradient-primary text-white font-semibold text-base shadow-[0_4px_14px_0_hsla(271,91%,65%,0.4)] hover:shadow-[0_6px_20px_0_hsla(271,91%,65%,0.5)] hover:opacity-95 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? "..." : isSignUp ? t("auth.sign_up") : t("auth.log_in")}
          </Button>
        </form>

        {!showForgotPassword && !isPasswordRecovery && <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400 font-medium">{t("auth.or_continue")}</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>}

        {!showForgotPassword && !isPasswordRecovery && <Button
          variant="outline"
          onClick={handleGoogleLogin}
          className="w-full h-12 rounded-xl border-gray-200 bg-white text-gray-700 font-medium hover:bg-gray-50 transition-all"
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          {t("auth.google")}
        </Button>}


        {!showForgotPassword && !isPasswordRecovery && <p className="text-center text-sm text-gray-500 mt-5">
          {isSignUp ? t("auth.has_account") : t("auth.no_account")} {" "}
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError("");
            }}
            className="text-primary font-semibold hover:underline"
          >
            {isSignUp ? t("auth.log_in") : t("auth.sign_up")}
          </button>
        </p>}
      </motion.div>

      <TermsModal open={termsOpen} onOpenChange={setTermsOpen} defaultTab={(localStorage.getItem("shinely_lang") as "en" | "pt" | "es") || "en"} />

      <div className="relative z-10 mt-6 flex items-center justify-center gap-3 text-xs text-white/80">
        <Link to="/terms" className="hover:text-white hover:underline">Terms</Link>
        <span aria-hidden="true">·</span>
        <Link to="/privacy" className="hover:text-white hover:underline">Privacy</Link>
        <span aria-hidden="true">·</span>
        <Link to="/cancellation" className="hover:text-white hover:underline">Cancellation</Link>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Sparkles, DollarSign, Users, MapPin } from "lucide-react";

export default function InvitePage() {
  const { referrerId } = useParams<{ referrerId: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [referrerName, setReferrerName] = useState<string | null>(null);

  useEffect(() => {
    if (!referrerId) return;
    // Store referral code for capture on signup
    try { localStorage.setItem("shinely_ref", referrerId); } catch {}
    // Load referrer's name
    supabase.from("public_profiles").select("full_name").eq("id", referrerId).maybeSingle()
      .then(({ data }) => {
        if (data) setReferrerName((data as any).full_name);
      });
  }, [referrerId]);

  const benefits = [
    { icon: MapPin, title: t("invite.benefit1_title"), desc: t("invite.benefit1_desc") },
    { icon: DollarSign, title: t("invite.benefit2_title"), desc: t("invite.benefit2_desc") },
    { icon: Users, title: t("invite.benefit3_title"), desc: t("invite.benefit3_desc") },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="gradient-primary px-6 pt-16 pb-10 text-center">
        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">{t("invite.welcome")}</h1>
        {referrerName && (
          <p className="text-white/80 text-sm">
            <span className="font-semibold text-white">{referrerName}</span>{" "}
            {t("invite.referred_by")}
          </p>
        )}
        <p className="text-white/70 text-xs mt-2">{t("invite.tagline")}</p>
      </div>

      {/* Benefits */}
      <div className="flex-1 px-5 py-6 space-y-4">
        {benefits.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="flex gap-4 bg-card rounded-2xl shadow-card p-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">{title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* CTAs */}
      <div className="px-5 pb-10 space-y-3">
        <Button
          onClick={() => navigate("/auth?mode=signup")}
          className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold text-base"
        >
          {t("invite.cta")}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          {t("invite.already_have")}{" "}
          <button onClick={() => navigate("/auth")} className="text-primary font-semibold underline">
            {t("invite.sign_in")}
          </button>
        </p>
      </div>
    </div>
  );
}

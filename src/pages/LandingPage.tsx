import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";
import { Sparkles, Shield, Zap, Star } from "lucide-react";
import { motion } from "framer-motion";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import logoImg from "@/assets/shinely-logo.png";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.5, ease: "easeOut" },
  }),
};

export default function LandingPage() {
  const { t } = useLanguage();

  const features = [
    { icon: Zap, titleKey: "landing.feature1_title", descKey: "landing.feature1_desc" },
    { icon: Shield, titleKey: "landing.feature2_title", descKey: "landing.feature2_desc" },
    { icon: Star, titleKey: "landing.feature3_title", descKey: "landing.feature3_desc" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <img src={logoImg} alt="Shinely" className="h-8 w-8 rounded-xl" />
          <span className="font-bold text-lg text-foreground tracking-tight">Shinely</span>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSwitcher variant="floating" />
          <Link to="/auth">
            <Button size="sm" variant="outline" className="rounded-full text-xs">
              {t("auth.log_in")}
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-5 text-center">
        <motion.div
          initial="hidden"
          animate="visible"
          className="max-w-md mx-auto flex flex-col items-center gap-6 py-12"
        >
          <motion.div custom={0} variants={fadeUp}>
            <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-semibold px-3 py-1 rounded-full mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              {t("landing.badge")}
            </div>
          </motion.div>

          <motion.h1
            custom={1}
            variants={fadeUp}
            className="text-3xl sm:text-4xl font-extrabold text-foreground leading-tight"
          >
            {t("landing.hero_title")}
          </motion.h1>

          <motion.p
            custom={2}
            variants={fadeUp}
            className="text-muted-foreground text-base sm:text-lg leading-relaxed"
          >
            {t("landing.hero_subtitle")}
          </motion.p>

          <motion.div custom={3} variants={fadeUp} className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto mt-2">
            <Link to="/auth" className="w-full sm:w-auto">
              <Button size="lg" className="w-full rounded-full font-semibold text-base">
                {t("landing.cta_get_started")}
              </Button>
            </Link>
          </motion.div>
        </motion.div>

        {/* Features */}
        <motion.div
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-2xl mx-auto pb-16 pt-4"
        >
          {features.map((f, i) => (
            <motion.div
              key={f.titleKey}
              custom={i + 4}
              variants={fadeUp}
              className="bg-card border border-border rounded-2xl p-5 text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <f.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground text-sm mb-1">{t(f.titleKey)}</h3>
              <p className="text-muted-foreground text-xs leading-relaxed">{t(f.descKey)}</p>
            </motion.div>
          ))}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="text-center text-[11px] text-muted-foreground pb-5 space-x-3">
        <Link to="/terms" className="hover:text-primary">Terms</Link>
        <span>·</span>
        <Link to="/privacy" className="hover:text-primary">Privacy</Link>
        <span>·</span>
        <Link to="/cancellation" className="hover:text-primary">Cancellation</Link>
      </footer>
    </div>
  );
}

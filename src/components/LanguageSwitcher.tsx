import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Language } from "@/i18n/translations";
import { motion, AnimatePresence } from "framer-motion";
import { Globe } from "lucide-react";

const languages: { code: Language; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "pt", label: "Português", flag: "🇧🇷" },
  { code: "es", label: "Español", flag: "🇪🇸" },
];

export default function LanguageSwitcher({ variant = "floating" }: { variant?: "floating" | "inline" }) {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const current = languages.find(l => l.code === language)!;

  if (variant === "inline") {
    return (
      <div className="flex gap-2">
        {languages.map(l => (
          <button key={l.code} onClick={() => setLanguage(l.code)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              language === l.code ? "bg-primary text-primary-foreground" : "bg-accent text-foreground hover:bg-accent/80"
            }`}>
            {l.flag} {l.code.toUpperCase()}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-card/80 backdrop-blur-sm border border-border/50 text-xs font-medium text-foreground hover:bg-card transition-all shadow-sm">
        <Globe className="w-3 h-3 text-primary" />
        <span>{current.flag} {current.code.toUpperCase()}</span>
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div initial={{ opacity: 0, y: -5, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -5, scale: 0.95 }}
              className="absolute right-0 top-full mt-1 bg-card rounded-xl shadow-elevated border border-border z-50 overflow-hidden min-w-[140px]">
              {languages.map(l => (
                <button key={l.code} onClick={() => { setLanguage(l.code); setOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors ${
                    language === l.code ? "bg-accent text-primary" : "text-foreground hover:bg-accent/50"
                  }`}>
                  <span>{l.flag}</span>
                  <span>{l.label}</span>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

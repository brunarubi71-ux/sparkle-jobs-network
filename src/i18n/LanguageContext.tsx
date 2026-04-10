import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { translations, Language } from "./translations";
import { supabase } from "@/integrations/supabase/client";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function detectLanguage(): Language {
  const nav = navigator.language || "";
  if (nav.startsWith("pt")) return "pt";
  if (nav.startsWith("es")) return "es";
  return "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem("shinely_lang");
    if (saved && ["en", "pt", "es"].includes(saved)) return saved as Language;
    return detectLanguage();
  });

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("shinely_lang", lang);
    // Persist to profile if logged in
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase.from("profiles").update({ language: lang }).eq("id", session.user.id);
    }
  };

  // Load from profile on mount
  useEffect(() => {
    const loadFromProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data } = await supabase.from("profiles").select("language").eq("id", session.user.id).single();
        if (data?.language && ["en", "pt", "es"].includes(data.language)) {
          setLanguageState(data.language as Language);
          localStorage.setItem("shinely_lang", data.language);
        }
      }
    };
    loadFromProfile();
  }, []);

  const t = (key: string) => translations[language][key] || translations.en[key] || key;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}

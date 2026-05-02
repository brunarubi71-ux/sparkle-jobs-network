import LegalPage from "@/components/LegalPage";
import { getLegal } from "@/content/legal";
import { useLanguage } from "@/i18n/LanguageContext";

export default function Privacy() {
  const { language } = useLanguage();
  return <LegalPage title="Privacy Policy" markdown={getLegal("privacy", language)} />;
}

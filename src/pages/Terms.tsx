import LegalPage from "@/components/LegalPage";
import { getLegal } from "@/content/legal";
import { useLanguage } from "@/i18n/LanguageContext";

export default function Terms() {
  const { language } = useLanguage();
  return <LegalPage title="Terms of Service" markdown={getLegal("terms", language)} />;
}

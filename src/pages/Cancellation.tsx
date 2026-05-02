import LegalPage from "@/components/LegalPage";
import { getLegal } from "@/content/legal";
import { useLanguage } from "@/i18n/LanguageContext";

export default function Cancellation() {
  const { language } = useLanguage();
  return <LegalPage title="Cancellation & Refund Policy" markdown={getLegal("cancellation", language)} />;
}

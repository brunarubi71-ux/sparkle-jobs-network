import { Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";

export default function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="w-full border-t border-border bg-background py-4 px-4 mt-auto">
      <nav className="max-w-2xl mx-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <Link to="/terms" className="hover:text-primary hover:underline">
          {t("footer.terms")}
        </Link>
        <span aria-hidden="true">·</span>
        <Link to="/privacy" className="hover:text-primary hover:underline">
          {t("footer.privacy")}
        </Link>
        <span aria-hidden="true">·</span>
        <Link to="/cancellation" className="hover:text-primary hover:underline">
          {t("footer.cancellation")}
        </Link>
      </nav>
    </footer>
  );
}

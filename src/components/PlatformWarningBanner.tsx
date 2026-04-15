import { Shield, AlertTriangle, Award } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

interface PlatformWarningBannerProps {
  role: "cleaner" | "owner";
  violationScore?: number;
  variant?: "info" | "warning" | "severe";
}

export default function PlatformWarningBanner({ role, violationScore = 0, variant }: PlatformWarningBannerProps) {
  const { t } = useLanguage();

  const effectiveVariant = variant || (
    violationScore >= 10 ? "severe" :
    violationScore >= 3 ? "warning" : "info"
  );

  const styles = {
    info: "bg-blue-50 border-blue-200 text-blue-700",
    warning: "bg-amber-50 border-amber-200 text-amber-700",
    severe: "bg-red-50 border-red-200 text-red-700",
  };

  const Icon = effectiveVariant === "severe" ? AlertTriangle : effectiveVariant === "warning" ? AlertTriangle : Shield;

  const message = role === "cleaner"
    ? t("protection.cleaner_warning")
    : t("protection.owner_warning");

  const incentive = t("protection.incentive");

  return (
    <div className={`rounded-xl border p-3 ${styles[effectiveVariant]}`}>
      <div className="flex items-start gap-2">
        <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div className="text-xs space-y-1">
          <p className="font-medium">{message}</p>
          {effectiveVariant === "info" && (
            <p className="flex items-center gap-1 opacity-80">
              <Award className="w-3 h-3" /> {incentive}
            </p>
          )}
          {violationScore >= 3 && (
            <p className="font-semibold">
              {t("protection.penalty_active")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

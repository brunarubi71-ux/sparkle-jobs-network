import { useState } from "react";
import { Users, Car, DollarSign, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";

export function HelperInfoBanner() {
  const [expanded, setExpanded] = useState(false);
  const { t } = useLanguage();

  return (
    <div className="mx-4 mb-3 rounded-2xl border-2 border-primary/20 bg-primary/5 overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">{t("helper.title")}</p>
            <p className="text-xs text-muted-foreground">{t("helper.subtitle")}</p>
          </div>
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {/* Expanded explanation */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-primary/10 pt-3">
          <p className="text-sm text-foreground font-medium">
            {t("helper.intro")}
          </p>

          <div className="space-y-2.5">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{t("helper.browse_title")}</p>
                <p className="text-xs text-muted-foreground">{t("helper.browse_desc")}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Car className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{t("helper.no_car_title")}</p>
                <p className="text-xs text-muted-foreground">{t("helper.no_car_desc")}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <DollarSign className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{t("helper.equal_pay_title")}</p>
                <p className="text-xs text-muted-foreground">{t("helper.equal_pay_desc")}</p>
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full rounded-xl border-primary/30 text-primary font-semibold mt-1"
            onClick={() => setExpanded(false)}
          >
            {t("helper.got_it")}
          </Button>
        </div>
      )}
    </div>
  );
}

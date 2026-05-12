import React from "react";
import { Badge } from "@/components/ui/badge";
import { Navigation, DollarSign, Flame, Home, Building2, BedDouble } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

export type JobFilter = "nearest" | "highest" | "urgent" | "residential" | "airbnb" | "commercial";

interface Props {
  active: JobFilter | null;
  onChange: (filter: JobFilter | null) => void;
}

export default function JobFilterChips({ active, onChange }: Props) {
  const { t } = useLanguage();

  const filters: { key: JobFilter; label: string; icon: React.ElementType }[] = [
    { key: "nearest",     label: t("jobs.filter.nearest"),     icon: Navigation },
    { key: "highest",     label: t("jobs.filter.highest"),     icon: DollarSign },
    { key: "urgent",      label: t("jobs.filter.urgent"),      icon: Flame },
    { key: "residential", label: t("jobs.filter.residential"), icon: Home },
    { key: "airbnb",      label: t("jobs.filter.airbnb"),      icon: BedDouble },
    { key: "commercial",  label: t("jobs.filter.commercial"),  icon: Building2 },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {filters.map(({ key, label, icon: Icon }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            onClick={() => onChange(isActive ? null : key)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-card text-muted-foreground border border-border hover:bg-accent/50"
            }`}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

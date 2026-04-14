import { useLocation, useNavigate } from "react-router-dom";
import { Briefcase, Calendar, MessageCircle, Crown, User, PlusCircle, List, ShoppingBag, ClipboardList, DollarSign } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { t } = useLanguage();

  const cleanerTabs = [
    { path: "/", label: t("nav.jobs"), icon: Briefcase },
    { path: "/cleaner-my-jobs", label: t("nav.my_jobs"), icon: ClipboardList },
    { path: "/earnings", label: t("nav.earnings"), icon: DollarSign },
    { path: "/chat", label: t("nav.chat"), icon: MessageCircle },
    { path: "/premium", label: t("nav.premium"), icon: Crown },
    { path: "/profile", label: t("nav.profile"), icon: User },
  ];

  const ownerTabs = [
    { path: "/post-job", label: t("nav.post_job"), icon: PlusCircle },
    { path: "/my-jobs", label: t("nav.my_jobs"), icon: List },
    { path: "/sell-schedule", label: t("nav.sell"), icon: ShoppingBag },
    { path: "/chat", label: t("nav.chat"), icon: MessageCircle },
    { path: "/profile", label: t("nav.profile"), icon: User },
  ];

  const tabs = profile?.role === "owner" ? ownerTabs : cleanerTabs;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const active = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <tab.icon className={`w-5 h-5 ${active ? "text-primary" : ""}`} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

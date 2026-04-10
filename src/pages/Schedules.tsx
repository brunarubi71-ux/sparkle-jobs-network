import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { MapPin, Home, Clock, DollarSign, Lock, Phone, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import ShimmerCard from "@/components/ShimmerCard";
import PremiumModal from "@/components/PremiumModal";
import BottomNav from "@/components/BottomNav";
import { useLanguage } from "@/i18n/LanguageContext";

interface Schedule {
  id: string;
  city: string;
  number_of_houses: number;
  frequency: string;
  monthly_income_estimate: number | null;
  asking_price: number | null;
  description: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
}

export default function Schedules() {
  const { user, profile, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => { fetchSchedules(); }, []);

  const fetchSchedules = async () => {
    setLoading(true);
    const { data } = await supabase.from("schedules").select("*").order("created_at", { ascending: false });
    setSchedules((data as Schedule[]) || []);
    setLoading(false);
  };

  const canUnlockContact = () => {
    if (!profile) return false;
    if (profile.is_premium) return true;
    return profile.free_contacts_used < 1;
  };

  const unlockContact = async (scheduleId: string) => {
    if (!user || !profile) return;
    if (profile.is_premium || unlockedIds.has(scheduleId)) {
      setUnlockedIds((s) => new Set(s).add(scheduleId));
      return;
    }
    if (!canUnlockContact()) { setShowPaywall(true); return; }
    await supabase.from("profiles").update({ free_contacts_used: profile.free_contacts_used + 1 }).eq("id", user.id);
    setUnlockedIds((s) => new Set(s).add(scheduleId));
    await refreshProfile();
  };

  const isUnlocked = (id: string) => profile?.is_premium || unlockedIds.has(id);

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-foreground">{t("schedules.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("schedules.subtitle")}</p>
      </div>

      <div className="px-4 space-y-3">
        {loading ? Array.from({ length: 3 }).map((_, i) => <ShimmerCard key={i} />) :
          schedules.length === 0 ? (
            <div className="text-center py-12"><p className="text-muted-foreground">{t("schedules.no_schedules")}</p></div>
          ) : schedules.map((s, i) => (
            <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-card rounded-2xl p-4 shadow-card">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1"><MapPin className="w-3.5 h-3.5" /> {s.city}</div>
                  <p className="text-lg font-bold text-foreground">{s.asking_price ? `$${s.asking_price}` : t("schedules.contact_price")}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground"><Home className="w-3 h-3" /> {s.number_of_houses} {t("schedules.houses")}</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5"><Clock className="w-3 h-3" /> {s.frequency}</div>
                </div>
              </div>
              {s.monthly_income_estimate && (
                <div className="flex items-center gap-1 text-sm text-primary font-medium mb-2">
                  <DollarSign className="w-3.5 h-3.5" /> ${s.monthly_income_estimate}{t("schedules.income")}
                </div>
              )}
              {s.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{s.description}</p>}
              {isUnlocked(s.id) ? (
                <div className="bg-accent rounded-xl p-3 space-y-1">
                  <div className="flex items-center gap-2 text-sm text-foreground"><User className="w-3.5 h-3.5 text-primary" /> {s.contact_name}</div>
                  {s.phone && <div className="flex items-center gap-2 text-sm text-foreground"><Phone className="w-3.5 h-3.5 text-primary" /> {s.phone}</div>}
                  {s.email && <div className="flex items-center gap-2 text-sm text-foreground"><Mail className="w-3.5 h-3.5 text-primary" /> {s.email}</div>}
                </div>
              ) : (
                <Button onClick={() => unlockContact(s.id)} variant="outline"
                  className="w-full h-10 rounded-xl border-primary text-primary font-medium hover:bg-accent">
                  <Lock className="w-4 h-4 mr-2" />
                  {canUnlockContact() ? t("schedules.unlock_contact") : t("schedules.unlock_premium")}
                </Button>
              )}
            </motion.div>
          ))
        }
      </div>

      <PremiumModal open={showPaywall} onClose={() => setShowPaywall(false)} title={t("premium.contact_limit")} message={t("premium.contact_limit_msg")} />
      <BottomNav />
    </div>
  );
}

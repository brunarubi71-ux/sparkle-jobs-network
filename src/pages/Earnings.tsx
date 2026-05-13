import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, Briefcase, Calendar, ArrowUp, ArrowDown, Award } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import EmptyState from "@/components/EmptyState";
import { PayoutSetup } from "@/components/PayoutSetup";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

interface EarningRow {
  amount: number;
  created_at: string;
  description: string;
  job_id: string | null;
}

export default function Earnings() {
  const { user, profile, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [jobs, setJobs] = useState<EarningRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Handle return from Stripe Connect onboarding
  useEffect(() => {
    const connectStatus = searchParams.get("connect");
    if (connectStatus === "success") {
      // Mark onboarding complete in DB and refresh profile
      (async () => {
        if (!user) return;
        try {
          const { error } = await supabase
            .from("profiles")
            .update({ stripe_connect_onboarded: true } as any)
            .eq("id", user.id);
          if (error) throw error;
          await refreshProfile();
          toast.success("Bank account connected! You can now withdraw your earnings.");
        } catch (e) {
          console.error("[Earnings] connect success handler error:", e);
          toast.error("Bank account setup may be incomplete. Please check your earnings page.");
        }
      })();
      setSearchParams({}, { replace: true });
    } else if (connectStatus === "refresh") {
      toast.info("Onboarding session expired. Please try again.");
      setSearchParams({}, { replace: true });
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("wallet_transactions")
          .select("amount, created_at, description, job_id")
          .eq("user_id", user.id)
          .eq("type", "credit")
          .not("job_id", "is", null)
          .order("created_at", { ascending: false });
        if (error) throw error;
        setJobs((data as EarningRow[]) || []);
      } catch (err) {
        console.error("[Earnings] fetch error:", err);
        toast.error("Couldn't load earnings. Please check your connection.");
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const stats = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const prevWeekStart = new Date(weekAgo.getTime() - 7 * 24 * 60 * 60 * 1000);

    const total = jobs.reduce((s, j) => s + (j.amount || 0), 0);
    const thisWeek = jobs.filter(j => new Date(j.created_at) >= weekAgo);
    const prevWeek = jobs.filter(j => {
      const d = new Date(j.created_at);
      return d >= prevWeekStart && d < weekAgo;
    });
    const thisMonth = jobs.filter(j => new Date(j.created_at) >= monthAgo);

    const weeklyEarnings = thisWeek.reduce((s, j) => s + (j.amount || 0), 0);
    const prevWeekEarnings = prevWeek.reduce((s, j) => s + (j.amount || 0), 0);
    const monthlyEarnings = thisMonth.reduce((s, j) => s + (j.amount || 0), 0);
    const avgPerJob = jobs.length > 0 ? total / jobs.length : 0;

    const weeklyTrend = prevWeekEarnings > 0
      ? ((weeklyEarnings - prevWeekEarnings) / prevWeekEarnings) * 100
      : weeklyEarnings > 0 ? 100 : 0;

    return { total, weeklyEarnings, monthlyEarnings, avgPerJob, weeklyTrend, jobsThisWeek: thisWeek.length, jobsThisMonth: thisMonth.length };
  }, [jobs]);

  const totalEarnings = profile?.total_earnings || stats.total;
  const jobsCompleted = profile?.jobs_completed || jobs.length;
  const isHelper = profile?.worker_type === "helper";
  const helperEarnings = (profile as any)?.helper_earnings || 0;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="gradient-primary px-6 pt-12 pb-20 text-center relative overflow-hidden">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-16 h-16 rounded-full bg-primary-foreground/20 mx-auto flex items-center justify-center mb-3"
        >
          <DollarSign className="w-8 h-8 text-primary-foreground" />
        </motion.div>
        <h1 className="text-2xl font-bold text-primary-foreground mb-1">{t("earnings.title")}</h1>
        <p className="text-primary-foreground/70 text-sm">{t("earnings.subtitle")}</p>
      </div>

      <div className="px-4 -mt-10 relative z-10 space-y-3">
        {/* Payout setup — only visible for cleaners/helpers */}
        {profile?.role === "cleaner" && (
          <PayoutSetup
            connectAccountId={(profile as any).stripe_connect_account_id ?? null}
            onboarded={(profile as any).stripe_connect_onboarded ?? false}
            onRefresh={refreshProfile}
          />
        )}

        {/* Total Earnings Hero Card */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-card rounded-2xl shadow-elevated p-5 text-center"
        >
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t("earnings.total_earned")}</p>
          <p className="text-4xl font-extrabold text-foreground">${totalEarnings.toFixed(2)}</p>
          <div className="flex items-center justify-center gap-1 mt-2">
            {stats.weeklyTrend >= 0 ? (
              <ArrowUp className="w-4 h-4 text-green-500" />
            ) : (
              <ArrowDown className="w-4 h-4 text-destructive" />
            )}
            <span className={`text-sm font-medium ${stats.weeklyTrend >= 0 ? "text-green-500" : "text-destructive"}`}>
              {stats.weeklyTrend >= 0 ? "+" : ""}{stats.weeklyTrend.toFixed(0)}%
            </span>
            <span className="text-xs text-muted-foreground ml-1">{t("earnings.vs_last_week")}</span>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
            className="bg-card rounded-2xl shadow-card p-4">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <Calendar className="w-4 h-4 text-primary" />
            </div>
            <p className="text-lg font-bold text-foreground">${stats.weeklyEarnings.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">{t("earnings.this_week")}</p>
            <p className="text-[10px] text-muted-foreground">{stats.jobsThisWeek} {t("earnings.jobs_label")}</p>
          </motion.div>

          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}
            className="bg-card rounded-2xl shadow-card p-4">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
            <p className="text-lg font-bold text-foreground">${stats.monthlyEarnings.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">{t("earnings.this_month")}</p>
            <p className="text-[10px] text-muted-foreground">{stats.jobsThisMonth} {t("earnings.jobs_label")}</p>
          </motion.div>

          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
            className="bg-card rounded-2xl shadow-card p-4">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <Briefcase className="w-4 h-4 text-primary" />
            </div>
            <p className="text-lg font-bold text-foreground">{jobsCompleted}</p>
            <p className="text-xs text-muted-foreground">{t("earnings.total_jobs")}</p>
          </motion.div>

          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }}
            className="bg-card rounded-2xl shadow-card p-4">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <Award className="w-4 h-4 text-primary" />
            </div>
            <p className="text-lg font-bold text-foreground">${stats.avgPerJob.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">{t("earnings.avg_per_job")}</p>
          </motion.div>
        </div>

        {/* Helper Earnings breakdown */}
        {isHelper && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.28 }}
            className="bg-card rounded-2xl shadow-card overflow-hidden border-2 border-primary/20"
          >
            {/* header stripe */}
            <div className="gradient-primary px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-primary-foreground" />
                <span className="text-sm font-bold text-primary-foreground">Helper Earnings</span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary-foreground/20 text-primary-foreground">
                Your role
              </span>
            </div>

            <div className="p-4 space-y-3">
              {/* total */}
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Total earned as Helper</p>
                <p className="text-4xl font-extrabold text-foreground">${helperEarnings.toFixed(2)}</p>
              </div>

              {/* breakdown */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border">
                <div className="text-center py-2">
                  <p className="text-xs text-muted-foreground mb-0.5">Jobs completed</p>
                  <p className="text-lg font-bold text-foreground">{jobsCompleted}</p>
                </div>
                <div className="text-center py-2 border-l border-border">
                  <p className="text-xs text-muted-foreground mb-0.5">Avg per job</p>
                  <p className="text-lg font-bold text-foreground">
                    ${jobsCompleted > 0 ? (helperEarnings / jobsCompleted).toFixed(0) : "0"}
                  </p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground bg-muted/50 rounded-xl px-3 py-2">
                You earn an equal share of the job payout alongside the Cleaner.
                Earnings go to your wallet and can be withdrawn to your bank account.
              </p>
            </div>
          </motion.div>
        )}

        {/* Recent Jobs */}
        {jobs.length > 0 && (
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
            className="bg-card rounded-2xl shadow-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">{t("earnings.recent_earnings")}</h3>
            <div className="space-y-2">
              {jobs.slice(0, 5).map((j, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex-1 mr-3">
                    <p className="text-sm font-medium text-foreground truncate">{j.description || t("earnings.completed_job")}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(j.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-green-500 shrink-0">
                    +${(j.amount || 0).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {!loading && jobs.length === 0 && (
          <EmptyState
            icon={DollarSign}
            title={t("earnings.empty_title")}
            description={t("earnings.empty_desc")}
          />
        )}

        {loading && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}

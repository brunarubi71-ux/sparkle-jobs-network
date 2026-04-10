import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, Bed, Bath, Eye, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ShimmerCard from "@/components/ShimmerCard";
import BottomNav from "@/components/BottomNav";
import { format } from "date-fns";
import { useLanguage } from "@/i18n/LanguageContext";

interface CleanerJob {
  id: string;
  title: string;
  cleaning_type: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  city: string | null;
  status: string;
  created_at: string;
  date_time: string | null;
}

export default function CleanerMyJobs() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [jobs, setJobs] = useState<CleanerJob[]>([]);
  const [loading, setLoading] = useState(true);

  const statusConfig: Record<string, { color: string; label: string; icon: string }> = {
    hired: { color: "bg-amber-100 text-amber-700", label: t("status.accepted"), icon: "🤝" },
    in_progress: { color: "bg-purple-100 text-purple-700", label: t("status.in_progress"), icon: "🔧" },
    pending_review: { color: "bg-indigo-100 text-indigo-700", label: t("status.pending_review"), icon: "⏳" },
    completed: { color: "bg-green-100 text-green-700", label: t("status.completed"), icon: "✅" },
    cancelled: { color: "bg-red-100 text-red-700", label: t("status.cancelled"), icon: "❌" },
  };

  useEffect(() => { if (user) fetchJobs(); }, [user]);

  const fetchJobs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("jobs")
      .select("id, title, cleaning_type, price, bedrooms, bathrooms, city, status, created_at, date_time")
      .eq("hired_cleaner_id", user!.id)
      .order("created_at", { ascending: false });
    setJobs((data as CleanerJob[]) || []);
    setLoading(false);
  };

  const activeJobs = jobs.filter(j => ["hired", "in_progress", "pending_review"].includes(j.status));
  const completedJobs = jobs.filter(j => j.status === "completed");
  const cancelledJobs = jobs.filter(j => j.status === "cancelled");

  const JobCard = ({ job, index }: { job: CleanerJob; index: number }) => {
    const s = statusConfig[job.status] || { color: "bg-muted text-muted-foreground", label: job.status.toUpperCase(), icon: "📌" };
    return (
      <motion.div key={job.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}
        className="bg-card rounded-2xl p-4 shadow-card">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">{job.title}</p>
            <p className="text-xl font-bold text-primary">${job.price}</p>
          </div>
          <Badge className={`${s.color} border-0 text-[10px] font-bold flex-shrink-0`}>{s.icon} {s.label}</Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {job.city || "N/A"}</span>
          <span className="flex items-center gap-1"><Bed className="w-3 h-3" /> {job.bedrooms}</span>
          <span className="flex items-center gap-1"><Bath className="w-3 h-3" /> {job.bathrooms}</span>
          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {format(new Date(job.created_at), "MMM d")}</span>
        </div>
        <Button size="sm" onClick={() => navigate(`/job/${job.id}`)}
          className="w-full h-9 text-xs rounded-xl gradient-primary text-white font-semibold">
          <Eye className="w-3 h-3 mr-1" /> {t("cleaner_jobs.view_job")}
        </Button>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-foreground">{t("cleaner_jobs.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("cleaner_jobs.subtitle")}</p>
      </div>

      <div className="px-4">
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="w-full mb-4 bg-accent rounded-xl">
            <TabsTrigger value="active" className="flex-1 rounded-lg text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-white">
              {t("cleaner_jobs.active")} ({activeJobs.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex-1 rounded-lg text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-white">
              {t("cleaner_jobs.completed")} ({completedJobs.length})
            </TabsTrigger>
            <TabsTrigger value="cancelled" className="flex-1 rounded-lg text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-white">
              {t("cleaner_jobs.cancelled")} ({cancelledJobs.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-3">
            {loading ? Array.from({ length: 3 }).map((_, i) => <ShimmerCard key={i} />) :
              activeJobs.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">{t("cleaner_jobs.no_active")}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t("cleaner_jobs.no_active_hint")}</p>
                </div>
              ) : activeJobs.map((job, i) => <JobCard key={job.id} job={job} index={i} />)
            }
          </TabsContent>

          <TabsContent value="completed" className="space-y-3">
            {loading ? Array.from({ length: 2 }).map((_, i) => <ShimmerCard key={i} />) :
              completedJobs.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">{t("cleaner_jobs.no_completed")}</p>
                </div>
              ) : completedJobs.map((job, i) => <JobCard key={job.id} job={job} index={i} />)
            }
          </TabsContent>

          <TabsContent value="cancelled" className="space-y-3">
            {loading ? Array.from({ length: 2 }).map((_, i) => <ShimmerCard key={i} />) :
              cancelledJobs.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">{t("cleaner_jobs.no_cancelled")}</p>
                </div>
              ) : cancelledJobs.map((job, i) => <JobCard key={job.id} job={job} index={i} />)
            }
          </TabsContent>
        </Tabs>
      </div>

      <BottomNav />
    </div>
  );
}

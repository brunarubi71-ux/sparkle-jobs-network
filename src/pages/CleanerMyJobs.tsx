import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, Bed, Bath, Eye, Calendar, Briefcase } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ShimmerCard from "@/components/ShimmerCard";
import BottomNav from "@/components/BottomNav";
import EmptyState from "@/components/EmptyState";
import { format } from "date-fns";
import { useLanguage } from "@/i18n/LanguageContext";

interface CleanerJob {
  id: string;
  title: string;
  cleaning_type: string | null;
  price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  city: string | null;
  status: string;
  created_at: string;
  date_time: string | null;
  cleaners_required?: number | null;
  helpers_required?: number | null;
}

interface AppliedJobRow {
  id: string;
  status: string;
  created_at: string;
  job_id: string;
  jobs: {
    id: string;
    title: string;
    price: number;
    city: string | null;
    status: string;
    cleaners_required: number | null;
    helpers_required: number | null;
  } | null;
}

const ACTIVE_STATUSES = ["accepted", "hired", "in_progress", "pending_review"];
const APPLIED_APPLICATION_STATUSES = ["pending", "applied", "waiting"];

export default function CleanerMyJobs() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const [jobs, setJobs] = useState<CleanerJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabCounts, setTabCounts] = useState({ active: 0, applied: 0, completed: 0, cancelled: 0 });
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "active");

  const profileJobsCompleted = (profile as any)?.jobs_completed ?? 0;

  const highlightJobId = searchParams.get("highlight");

  const statusConfig: Record<string, { color: string; label: string; icon: string }> = {
    pending: { color: "bg-amber-100 text-amber-700", label: "Awaiting approval", icon: "⏳" },
    applied: { color: "bg-amber-100 text-amber-700", label: "Awaiting approval", icon: "⏳" },
    waiting: { color: "bg-amber-100 text-amber-700", label: "Awaiting approval", icon: "⏳" },
    accepted: { color: "bg-purple-100 text-purple-700", label: "Hired", icon: "🤝" },
    hired: { color: "bg-purple-100 text-purple-700", label: "Hired", icon: "🤝" },
    in_progress: { color: "bg-blue-100 text-blue-700", label: "In Progress", icon: "🔧" },
    pending_review: { color: "bg-indigo-100 text-indigo-700", label: t("status.pending_review"), icon: "⏳" },
    completed: { color: "bg-green-100 text-green-700", label: "Completed", icon: "✅" },
    cancelled: { color: "bg-red-100 text-red-700", label: t("status.cancelled"), icon: "❌" },
  };

  useEffect(() => {
    setActiveTab(searchParams.get("tab") || "active");
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;
    fetchJobs();
    fetchTabCounts();

    const channel = supabase
      .channel(`cleaner-myjobs-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "job_applications", filter: `cleaner_id=eq.${user.id}` },
        () => {
          fetchJobs();
          fetchTabCounts();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs", filter: `hired_cleaner_id=eq.${user.id}` },
        () => {
          fetchJobs();
          fetchTabCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchTabCounts = async () => {
    if (!user) return;
    const [activeRes, completedRes, cancelledRes, appliedRes] = await Promise.all([
      supabase
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("hired_cleaner_id", user.id)
        .in("status", ["accepted", "in_progress"]),
      supabase
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("hired_cleaner_id", user.id)
        .eq("status", "completed"),
      supabase
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("hired_cleaner_id", user.id)
        .eq("status", "cancelled"),
      supabase
        .from("job_applications")
        .select(`
          id,
          status,
          created_at,
          job_id,
          jobs (
            id, title, price, city, status,
            cleaners_required, helpers_required
          )
        `, { count: "exact" })
        .eq("cleaner_id", user.id)
        .in("status", APPLIED_APPLICATION_STATUSES),
    ]);

    setTabCounts({
      active: activeRes.count ?? 0,
      applied: appliedRes.count ?? 0,
      completed: completedRes.count ?? 0,
      cancelled: cancelledRes.count ?? 0,
    });
  };

  const fetchJobs = async () => {
    setLoading(true);

    const [hiredJobsRes, appliedJobsRes] = await Promise.all([
      supabase
        .from("jobs")
        .select("id, title, cleaning_type, price, bedrooms, bathrooms, city, status, created_at, date_time")
        .eq("hired_cleaner_id", user!.id)
        .in("status", ["hired", "accepted", "in_progress", "pending_review", "completed", "cancelled"])
        .order("created_at", { ascending: false }),
      supabase
        .from("job_applications")
        .select(`
          id,
          status,
          created_at,
          job_id,
          jobs (
            id, title, price, city, status,
            cleaners_required, helpers_required
          )
        `)
        .eq("cleaner_id", user!.id)
        .in("status", APPLIED_APPLICATION_STATUSES)
        .order("created_at", { ascending: false }),
    ]);

    const hired = (hiredJobsRes.data as CleanerJob[]) || [];
    const hiredIds = new Set(hired.map((job) => job.id));

    const applied = ((appliedJobsRes.data as AppliedJobRow[]) || [])
      .map((row) => {
        if (!row.jobs || hiredIds.has(row.jobs.id)) return null;

        return {
          id: row.jobs.id,
          title: row.jobs.title,
          cleaning_type: null,
          price: row.jobs.price,
          bedrooms: null,
          bathrooms: null,
          city: row.jobs.city,
          status: row.status,
          created_at: row.created_at,
          date_time: null,
          cleaners_required: row.jobs.cleaners_required,
          helpers_required: row.jobs.helpers_required,
        } satisfies CleanerJob;
      })
      .filter((job): job is CleanerJob => Boolean(job));

    setJobs([...applied, ...hired]);
    setTabCounts((current) => ({ ...current, applied: applied.length }));
    setLoading(false);
  };

  const sortJobs = (items: CleanerJob[]) =>
    [...items].sort((a, b) => {
      if (highlightJobId) {
        if (a.id === highlightJobId) return -1;
        if (b.id === highlightJobId) return 1;
      }

      const statusOrder: Record<string, number> = {
        pending: 0,
        applied: 0,
        waiting: 0,
        hired: 1,
        accepted: 2,
        in_progress: 3,
        pending_review: 4,
        completed: 5,
        cancelled: 6,
      };

      const statusDelta = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
      if (statusDelta !== 0) return statusDelta;

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const activeJobs = useMemo(() => sortJobs(jobs.filter((job) => ACTIVE_STATUSES.includes(job.status))), [jobs, highlightJobId]);
  const appliedJobs = useMemo(
    () => sortJobs(jobs.filter((job) => APPLIED_APPLICATION_STATUSES.includes(job.status))),
    [jobs, highlightJobId]
  );
  const completedJobs = useMemo(() => sortJobs(jobs.filter((job) => job.status === "completed")), [jobs, highlightJobId]);
  const cancelledJobs = useMemo(() => sortJobs(jobs.filter((job) => job.status === "cancelled")), [jobs, highlightJobId]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", value);
    if (value !== "active") nextParams.delete("highlight");
    setSearchParams(nextParams, { replace: true });
  };

  const JobCard = ({ job, index }: { job: CleanerJob; index: number }) => {
    const status = statusConfig[job.status] || {
      color: "bg-muted text-muted-foreground",
      label: job.status.toUpperCase(),
      icon: "📌",
    };

    const isHighlighted = highlightJobId === job.id;

    return (
      <motion.div
        key={job.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04 }}
        className={`rounded-2xl border bg-card p-4 shadow-card ${isHighlighted ? "border-primary ring-2 ring-primary/15" : "border-border"}`}
      >
        <div className="mb-2 flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-foreground">{job.title}</p>
            <p className="text-xl font-bold text-primary">${job.price}</p>
          </div>
          <Badge className={`${status.color} border-0 text-[10px] font-bold`}>
            {status.icon} {status.label}
          </Badge>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {job.city || "N/A"}
          </span>
          <span className="flex items-center gap-1">
            <Bed className="h-3 w-3" /> {job.bedrooms}
          </span>
          <span className="flex items-center gap-1">
            <Bath className="h-3 w-3" /> {job.bathrooms}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" /> {format(new Date(job.date_time || job.created_at), "MMM d")}
          </span>
        </div>

        <Button
          size="sm"
          onClick={() => navigate(`/job/${job.id}`)}
          className="h-10 w-full rounded-xl gradient-primary text-xs font-semibold text-primary-foreground"
        >
          <Eye className="mr-1 h-3 w-3" /> {t("cleaner_jobs.view_job")}
        </Button>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-4 pb-4 pt-6">
        <h1 className="text-2xl font-bold text-foreground">{t("cleaner_jobs.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("cleaner_jobs.subtitle")}</p>
      </div>

      <div className="px-4">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="mb-4 grid w-full grid-cols-4 rounded-2xl bg-accent p-1">
            <TabsTrigger value="active" className="rounded-xl text-[11px] font-semibold data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-card">
              {t("cleaner_jobs.active")} ({tabCounts.active})
            </TabsTrigger>
            <TabsTrigger value="applied" className="rounded-xl text-[11px] font-semibold data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-card">
              {t("cleaner_jobs.applied")} ({tabCounts.applied})
            </TabsTrigger>
            <TabsTrigger value="completed" className="rounded-xl text-[11px] font-semibold data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-card">
              {t("cleaner_jobs.completed")} ({tabCounts.completed})
            </TabsTrigger>
            <TabsTrigger value="cancelled" className="rounded-xl text-[11px] font-semibold data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-card">
              {t("cleaner_jobs.cancelled")} ({tabCounts.cancelled})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, index) => <ShimmerCard key={index} />)
            ) : activeJobs.length === 0 ? (
              <EmptyState
                icon={Briefcase}
                title={t("cleaner_jobs.no_active_title")}
                description={t("cleaner_jobs.no_active_desc")}
              />
            ) : (
              activeJobs.map((job, index) => <JobCard key={job.id} job={job} index={index} />)
            )}
          </TabsContent>

          <TabsContent value="applied" className="space-y-3">
            {loading ? (
              Array.from({ length: 2 }).map((_, index) => <ShimmerCard key={index} />)
            ) : appliedJobs.length === 0 ? (
              <EmptyState
                icon={Briefcase}
                title={t("cleaner_jobs.no_applied")}
                description={t("cleaner_jobs.no_applied_hint")}
              />
            ) : (
              appliedJobs.map((job, index) => <JobCard key={job.id} job={job} index={index} />)
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-3">
            {loading ? (
              Array.from({ length: 2 }).map((_, index) => <ShimmerCard key={index} />)
            ) : completedJobs.length === 0 ? (
              <EmptyState
                icon={Briefcase}
                title={t("cleaner_jobs.no_completed_title")}
                description={t("cleaner_jobs.no_completed_desc")}
              />
            ) : (
              completedJobs.map((job, index) => <JobCard key={job.id} job={job} index={index} />)
            )}
          </TabsContent>

          <TabsContent value="cancelled" className="space-y-3">
            {loading ? (
              Array.from({ length: 2 }).map((_, index) => <ShimmerCard key={index} />)
            ) : cancelledJobs.length === 0 ? (
              <EmptyState
                icon={Briefcase}
                title={t("cleaner_jobs.no_cancelled_title")}
                description={t("cleaner_jobs.no_cancelled_desc")}
              />
            ) : (
              cancelledJobs.map((job, index) => <JobCard key={job.id} job={job} index={index} />)
            )}
          </TabsContent>
        </Tabs>
      </div>

      <BottomNav />
    </div>
  );
}

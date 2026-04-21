import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, Bed, Bath, Users, Star, Eye, CheckCircle, XCircle, ImageIcon, AlertTriangle, Clock, Shield, Briefcase, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ShimmerCard from "@/components/ShimmerCard";
import BottomNav from "@/components/BottomNav";
import EmptyState from "@/components/EmptyState";
import BackToTop from "@/components/BackToTop";
import PullToRefresh from "@/components/PullToRefresh";
import { toast } from "sonner";
import ReviewModal from "@/components/ReviewModal";
import DisputeModal from "@/components/DisputeModal";
import { awardPoints } from "@/lib/points";
import { useLanguage } from "@/i18n/LanguageContext";
import NotificationBell from "@/components/NotificationBell";

interface JobWithApplicants {
  id: string;
  title: string;
  cleaning_type: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  city: string | null;
  urgency: string;
  status: string;
  total_amount: number;
  platform_fee: number;
  cleaner_earnings: number;
  hired_cleaner_id: string | null;
  team_size_required: number;
  cleaners_required: number;
  helpers_required: number;
  created_at: string;
  completion_photos: string[] | null;
  completion_notes: string | null;
  escrow_status: string;
  pending_review_at: string | null;
  applicants: { id: string; cleaner_id: string; status: string; cleaner_name?: string; worker_type?: "cleaner" | "helper"; avatar_url?: string | null }[];
}

const ACTIVE_STATUSES = ["pending_payment", "open", "applied", "hired", "accepted"];
const IN_PROGRESS_STATUSES = ["in_progress"];
const APPROVAL_STATUSES = ["pending_review"];

export default function MyJobs() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [jobs, setJobs] = useState<JobWithApplicants[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewJob, setReviewJob] = useState<{ jobId: string; reviewedId: string } | null>(null);
  const [disputeJob, setDisputeJob] = useState<{ jobId: string; reportedId: string } | null>(null);
  const [activeTab, setActiveTab] = useState("active");

  useEffect(() => { if (user) fetchJobs(); }, [user]);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const { data: jobsData, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!jobsData) { setJobs([]); return; }

      const jobsWithApplicants: JobWithApplicants[] = [];
      for (const job of jobsData) {
        const { data: apps } = await supabase
          .from("job_applications")
          .select("id, cleaner_id, status")
          .eq("job_id", job.id);
        const applicants = [];
        for (const app of apps || []) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, worker_type, avatar_url")
            .eq("id", app.cleaner_id)
            .single();
          applicants.push({
            ...app,
            cleaner_name: profile?.full_name || "Cleaner",
            worker_type: ((profile as any)?.worker_type === "helper" ? "helper" : "cleaner") as "cleaner" | "helper",
            avatar_url: (profile as any)?.avatar_url ?? null,
          });
        }
        jobsWithApplicants.push({ ...job, applicants } as JobWithApplicants);
      }
      setJobs(jobsWithApplicants);
    } catch (err) {
      console.error("[MyJobs] fetch error:", err);
      toast.error("Couldn't load your jobs. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const hireCleaner = async (jobId: string, cleanerId: string) => {
    await supabase.from("jobs").update({ status: "hired", hired_cleaner_id: cleanerId }).eq("id", jobId);
    await supabase.from("job_applications").update({ status: "hired" }).eq("job_id", jobId).eq("cleaner_id", cleanerId);
    const { data: existing } = await supabase.from("conversations").select("id").eq("job_id", jobId).eq("cleaner_id", cleanerId).maybeSingle();
    if (!existing) await supabase.from("conversations").insert({ job_id: jobId, cleaner_id: cleanerId, owner_id: user!.id });
    toast.success(t("myjobs.cleaner_hired"));
    fetchJobs();
  };

  const cancelJob = async (jobId: string) => {
    // Find affected workers (pending or accepted applicants + lead hired cleaner)
    const affected = new Set<string>();
    let jobTitle = "";
    try {
      const { data: jobRow } = await supabase
        .from("jobs")
        .select("title, hired_cleaner_id")
        .eq("id", jobId)
        .maybeSingle();
      jobTitle = (jobRow as any)?.title ?? "";
      if ((jobRow as any)?.hired_cleaner_id) affected.add((jobRow as any).hired_cleaner_id);

      const { data: apps } = await supabase
        .from("job_applications")
        .select("cleaner_id, status")
        .eq("job_id", jobId)
        .in("status", ["pending", "accepted"]);
      (apps || []).forEach((a: any) => { if (a.cleaner_id) affected.add(a.cleaner_id); });
    } catch (e) {
      console.error("[MyJobs] cancel: failed to load affected workers", e);
    }

    await supabase.from("jobs").update({ status: "cancelled" }).eq("id", jobId);

    // Notify all affected workers
    if (affected.size > 0) {
      const rows = Array.from(affected).map((uid) => ({
        user_id: uid,
        title: "Job Cancelled",
        message: `The job "${jobTitle || "this job"}" has been cancelled by the owner.`,
        type: "job_cancelled",
        related_id: jobId,
        link: `/job/${jobId}`,
      }));
      try {
        await supabase.from("notifications").insert(rows);
      } catch (e) {
        console.error("[MyJobs] cancel notification failed", e);
      }
    }

    toast.success(t("myjobs.job_cancelled"));
    fetchJobs();
  };

  const activateJob = async (jobId: string) => {
    const { error } = await supabase.from("jobs").update({ status: "open" }).eq("id", jobId);
    if (error) {
      toast.error("Failed to activate job");
      return;
    }
    toast.success("Job activated (test mode)");
    fetchJobs();
  };

  const approveJob = async (jobId: string) => {
    const job = jobs.find((j) => j.id === jobId);
    await supabase.from("jobs").update({
      status: "completed",
      owner_confirmed_completion: true,
      escrow_status: "released",
    } as any).eq("id", jobId);

    // Award points: owner gets owner_job_completed; worker gets job_completed (+ first_job bonus)
    try {
      if (user) await awardPoints(user.id, "owner_job_completed");
      if (job?.hired_cleaner_id) {
        await awardPoints(job.hired_cleaner_id, "job_completed");
        await awardPoints(job.hired_cleaner_id, "first_job_completed"); // one-time
      }
    } catch {}

    toast.success(t("myjobs.job_approved"));
    fetchJobs();
  };

  const activeJobs = useMemo(() => jobs.filter(j => ACTIVE_STATUSES.includes(j.status)), [jobs]);
  const inProgressJobs = useMemo(() => jobs.filter(j => IN_PROGRESS_STATUSES.includes(j.status)), [jobs]);
  const approvalJobs = useMemo(() => jobs.filter(j => APPROVAL_STATUSES.includes(j.status)), [jobs]);
  const completedJobs = useMemo(() => jobs.filter(j => j.status === "completed"), [jobs]);
  const cancelledJobs = useMemo(() => jobs.filter(j => j.status === "cancelled"), [jobs]);

  const statusConfig: Record<string, { color: string; label: string }> = {
    pending_payment: { color: "bg-yellow-100 text-yellow-800", label: "Pending Payment" },
    open: { color: "bg-emerald-100 text-emerald-700", label: t("status.open") },
    applied: { color: "bg-amber-100 text-amber-700", label: "Awaiting Approval" },
    pending: { color: "bg-amber-100 text-amber-700", label: "Awaiting Approval" },
    hired: { color: "bg-purple-100 text-purple-700", label: "Hired" },
    accepted: { color: "bg-purple-100 text-purple-700", label: "Hired" },
    in_progress: { color: "bg-blue-100 text-blue-700", label: "In Progress" },
    pending_review: { color: "bg-indigo-100 text-indigo-700", label: t("status.pending_review") },
    completed: { color: "bg-green-100 text-green-700", label: "Completed" },
    cancelled: { color: "bg-red-100 text-red-700", label: t("status.cancelled") },
  };

  const JobCard = ({ job, index }: { job: JobWithApplicants; index: number }) => {
    const status = statusConfig[job.status] || { color: "bg-muted text-muted-foreground", label: job.status };
    const showApproval = APPROVAL_STATUSES.includes(job.status);

    return (
      <motion.div
        key={job.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04 }}
        className="bg-card rounded-2xl p-4 shadow-card border border-border"
      >
        <div className="flex items-start justify-between mb-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground truncate">{job.title}</p>
            <p className="text-xl font-bold text-primary">${job.price}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Badge className={`${status.color} border-0 text-[10px] font-bold`}>{status.label}</Badge>
            {import.meta.env.DEV && job.status === "pending_payment" && (
              <Button
                size="sm"
                onClick={() => activateJob(job.id)}
                className="h-6 px-2 text-[10px] gradient-primary text-primary-foreground rounded-lg"
              >
                [TEST] Activate Job
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {job.city || "N/A"}</span>
          <span className="flex items-center gap-1"><Bed className="w-3 h-3" /> {job.bedrooms}</span>
          <span className="flex items-center gap-1"><Bath className="w-3 h-3" /> {job.bathrooms}</span>
        </div>

        <div className="bg-accent rounded-xl p-2.5 text-xs mb-3">
          <div className="flex justify-between"><span className="text-muted-foreground">{t("myjobs.total")}</span><span className="font-medium">${job.total_amount || job.price}</span></div>
        </div>

        {/* Team progress for team jobs (separate Cleaners/Helpers) */}
        {((job.cleaners_required ?? 0) + (job.helpers_required ?? 0)) >= 2 && ACTIVE_STATUSES.includes(job.status) && (() => {
          const cleanersReq = job.cleaners_required ?? 0;
          const helpersReq = job.helpers_required ?? 0;
          const acceptedApps = job.applicants.filter(a => a.status === "accepted" || a.status === "hired");
          const cleanersFilled = acceptedApps.filter(a => a.worker_type === "cleaner").length;
          const helpersFilled = acceptedApps.filter(a => a.worker_type === "helper").length;
          const cleanersPct = cleanersReq > 0 ? Math.min(100, (cleanersFilled / cleanersReq) * 100) : 100;
          const helpersPct = helpersReq > 0 ? Math.min(100, (helpersFilled / helpersReq) * 100) : 100;
          return (
            <div className="mb-3 bg-primary/5 border border-primary/15 rounded-xl p-3 space-y-2.5">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-primary" /> Team job composition
              </p>
              {cleanersReq > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-medium text-foreground">🚗 Cleaners: {cleanersFilled}/{cleanersReq} filled</span>
                    <span className={`text-[11px] font-bold ${cleanersFilled >= cleanersReq ? "text-emerald-600" : "text-primary"}`}>
                      {Math.round(cleanersPct)}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full transition-all ${cleanersFilled >= cleanersReq ? "bg-emerald-500" : "bg-primary"}`}
                      style={{ width: `${cleanersPct}%` }}
                    />
                  </div>
                </div>
              )}
              {helpersReq > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-medium text-foreground">🤝 Helpers: {helpersFilled}/{helpersReq} filled</span>
                    <span className={`text-[11px] font-bold ${helpersFilled >= helpersReq ? "text-emerald-600" : "text-primary"}`}>
                      {Math.round(helpersPct)}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full transition-all ${helpersFilled >= helpersReq ? "bg-emerald-500" : "bg-primary"}`}
                      style={{ width: `${helpersPct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Applicants for active jobs */}
        {job.applicants.length > 0 && ACTIVE_STATUSES.includes(job.status) && (() => {
          const isTeam = (job.team_size_required ?? 1) >= 2;
          const cleanerApps = job.applicants.filter(a => a.worker_type === "cleaner");
          const helperApps = job.applicants.filter(a => a.worker_type === "helper");

          const renderApp = (app: typeof job.applicants[number]) => (
            <div key={app.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <button
                onClick={() => navigate(`/profile/${app.cleaner_id}`)}
                className="flex items-center gap-2 text-sm text-foreground font-medium hover:text-primary text-left flex-1 min-w-0"
              >
                <div className="w-7 h-7 rounded-full bg-accent overflow-hidden flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                  {app.avatar_url ? (
                    <img src={app.avatar_url} alt={app.cleaner_name} className="w-full h-full object-cover" />
                  ) : (
                    (app.cleaner_name || "?").charAt(0).toUpperCase()
                  )}
                </div>
                <span className="truncate">{app.cleaner_name}</span>
              </button>
              {!isTeam && ["open", "applied"].includes(job.status) && app.status !== "hired" && app.status !== "accepted" && (
                <Button size="sm" onClick={() => hireCleaner(job.id, app.cleaner_id)}
                  className="h-7 text-xs gradient-primary text-primary-foreground rounded-lg">
                  {t("myjobs.hire")}
                </Button>
              )}
              {(app.status === "hired" || (isTeam && app.status === "accepted")) && (
                <Badge className="bg-primary/10 text-primary border-0 text-[10px]">{t("myjobs.hired")}</Badge>
              )}
            </div>
          );

          if (!isTeam) {
            return (
              <div className="mb-3">
                <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-1">
                  <Users className="w-3 h-3" /> {t("myjobs.applicants")} ({job.applicants.length})
                </p>
                {job.applicants.map(renderApp)}
              </div>
            );
          }

          return (
            <div className="mb-3 space-y-3">
              <div>
                <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-primary" /> Cleaner ({cleanerApps.length})
                </p>
                {cleanerApps.length > 0
                  ? cleanerApps.map(renderApp)
                  : <p className="text-xs text-muted-foreground italic">No Cleaner yet</p>}
              </div>
              <div>
                <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-1">
                  <Users className="w-3 h-3 text-primary" /> Helpers ({helperApps.length})
                </p>
                {helperApps.length > 0
                  ? helperApps.map(renderApp)
                  : <p className="text-xs text-muted-foreground italic">No Helpers yet</p>}
              </div>
            </div>
          );
        })()}

        {/* Escrow status badge */}
        {job.escrow_status && job.escrow_status !== "pending" && (
          <div className="mb-3">
            <Badge className={`text-[10px] font-bold border-0 ${
              job.escrow_status === "paid" ? "bg-blue-100 text-blue-700" :
              job.escrow_status === "released" ? "bg-green-100 text-green-700" :
              job.escrow_status === "disputed" ? "bg-red-100 text-red-700" :
              "bg-muted text-muted-foreground"
            }`}>
              <Shield className="w-3 h-3 mr-1" />
              {t(`escrow.${job.escrow_status}`)}
            </Badge>
          </div>
        )}

        {/* Approval section with completion photos */}
        {showApproval && (
          <div className="mb-3 space-y-3">
            {/* Auto-approve countdown */}
            {job.pending_review_at && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-xs flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-amber-700">{t("myjobs.auto_approve_warning")}</span>
              </div>
            )}

            {job.completion_photos && job.completion_photos.length > 0 && (
              <div>
                <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-1">
                  <ImageIcon className="w-3 h-3" /> {t("myjobs.completion_photos")}
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {job.completion_photos.map((url, i) => (
                    <img key={i} src={url} alt="" className="rounded-lg aspect-square object-cover w-full" />
                  ))}
                </div>
              </div>
            )}
            {job.completion_notes && (
              <div className="bg-accent/50 rounded-xl p-3">
                <p className="text-xs font-medium text-foreground mb-1">{t("myjobs.completion_notes")}</p>
                <p className="text-xs text-muted-foreground">{job.completion_notes}</p>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          {showApproval && (
            <>
              <Button size="sm" onClick={() => approveJob(job.id)}
                className="flex-1 h-9 text-xs gradient-primary text-primary-foreground rounded-xl">
                <CheckCircle className="w-3 h-3 mr-1" /> {t("myjobs.approve")}
              </Button>
              {job.hired_cleaner_id && job.escrow_status !== "disputed" && (
                <Button size="sm" variant="outline" onClick={() => setDisputeJob({ jobId: job.id, reportedId: job.hired_cleaner_id! })}
                  className="h-9 text-xs text-destructive border-destructive/30 rounded-xl">
                  <AlertTriangle className="w-3 h-3 mr-1" /> {t("myjobs.report_issue")}
                </Button>
              )}
              {job.escrow_status === "disputed" && (
                <Badge className="bg-red-100 text-red-700 border-0 text-[10px]">{t("dispute.under_review")}</Badge>
              )}
            </>
          )}
          {["hired", "in_progress", "pending_review", "completed"].includes(job.status) && (
            <Button size="sm" variant="outline" onClick={() => navigate(`/job/${job.id}`)}
              className="flex-1 h-9 text-xs rounded-xl">
              <Eye className="w-3 h-3 mr-1" /> {t("myjobs.view_details")}
            </Button>
          )}
          {job.status === "completed" && (
            <Button size="sm" variant="outline" onClick={() => job.hired_cleaner_id && setReviewJob({ jobId: job.id, reviewedId: job.hired_cleaner_id })}
              className="flex-1 h-9 text-xs rounded-xl">
              <Star className="w-3 h-3 mr-1" /> {t("myjobs.review")}
            </Button>
          )}
          {!["completed", "cancelled", "pending_review"].includes(job.status) && (
            <Button size="sm" variant="outline" onClick={() => cancelJob(job.id)}
              className="h-9 text-xs text-destructive border-destructive/30 rounded-xl">
              <XCircle className="w-3 h-3 mr-1" /> {t("myjobs.cancel")}
            </Button>
          )}
        </div>
      </motion.div>
    );
  };

  const renderEmpty = (message: string) => (
    <EmptyState
      icon={Briefcase}
      title="No jobs posted yet 🏠"
      description="Post your first job and find a trusted cleaner today!"
    />
  );

  const renderList = (list: JobWithApplicants[], emptyMsg: string) =>
    loading
      ? Array.from({ length: 3 }).map((_, i) => <ShimmerCard key={i} />)
      : list.length === 0
        ? renderEmpty(emptyMsg)
        : list.map((job, i) => <JobCard key={job.id} job={job} index={i} />);

  return (
    <PullToRefresh onRefresh={fetchJobs}>
    <div className="min-h-screen bg-background pb-20">
      <div className="px-4 pt-6 pb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">{t("myjobs.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("myjobs.subtitle")}</p>
        </div>
        <NotificationBell />
      </div>

      <div className="px-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4 w-full rounded-2xl bg-accent p-1 flex overflow-x-auto">
            <TabsTrigger value="active" className="flex-1 min-w-0 rounded-xl text-[10px] font-semibold data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-card px-2">
              {t("myjobs.tab_active")} ({activeJobs.length})
            </TabsTrigger>
            <TabsTrigger value="in_progress" className="flex-1 min-w-0 rounded-xl text-[10px] font-semibold data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-card px-2">
              {t("myjobs.tab_in_progress")} ({inProgressJobs.length})
            </TabsTrigger>
            <TabsTrigger value="approval" className="flex-1 min-w-0 rounded-xl text-[10px] font-semibold data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-card px-2">
              {t("myjobs.tab_approval")} ({approvalJobs.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex-1 min-w-0 rounded-xl text-[10px] font-semibold data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-card px-2">
              {t("myjobs.tab_completed")} ({completedJobs.length})
            </TabsTrigger>
            <TabsTrigger value="cancelled" className="flex-1 min-w-0 rounded-xl text-[10px] font-semibold data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-card px-2">
              {t("myjobs.tab_cancelled")} ({cancelledJobs.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-3">
            {renderList(activeJobs, t("myjobs.no_active"))}
          </TabsContent>
          <TabsContent value="in_progress" className="space-y-3">
            {renderList(inProgressJobs, t("myjobs.no_in_progress"))}
          </TabsContent>
          <TabsContent value="approval" className="space-y-3">
            {renderList(approvalJobs, t("myjobs.no_approval"))}
          </TabsContent>
          <TabsContent value="completed" className="space-y-3">
            {renderList(completedJobs, t("myjobs.no_completed"))}
          </TabsContent>
          <TabsContent value="cancelled" className="space-y-3">
            {renderList(cancelledJobs, t("myjobs.no_cancelled"))}
          </TabsContent>
        </Tabs>
      </div>

      {reviewJob && (
        <ReviewModal open={!!reviewJob} onClose={() => { setReviewJob(null); fetchJobs(); }} jobId={reviewJob.jobId} reviewedId={reviewJob.reviewedId} />
      )}
      {disputeJob && (
        <DisputeModal open={!!disputeJob} onClose={() => { setDisputeJob(null); fetchJobs(); }} jobId={disputeJob.jobId} reportedId={disputeJob.reportedId} />
      )}
      <BackToTop />
      <BottomNav />
    </div>
    </PullToRefresh>
  );
}

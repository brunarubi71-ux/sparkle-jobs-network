import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, Bed, Bath, Users, CheckCircle, XCircle, Star, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ShimmerCard from "@/components/ShimmerCard";
import BottomNav from "@/components/BottomNav";
import { toast } from "sonner";
import ReviewModal from "@/components/ReviewModal";

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
  created_at: string;
  applicants: { id: string; cleaner_id: string; status: string; cleaner_name?: string }[];
}

export default function MyJobs() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobWithApplicants[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewJob, setReviewJob] = useState<{ jobId: string; reviewedId: string } | null>(null);

  useEffect(() => { if (user) fetchJobs(); }, [user]);

  const fetchJobs = async () => {
    setLoading(true);
    const { data: jobsData } = await supabase
      .from("jobs")
      .select("*")
      .eq("owner_id", user!.id)
      .order("created_at", { ascending: false });

    if (!jobsData) { setLoading(false); return; }

    const jobsWithApplicants: JobWithApplicants[] = [];
    for (const job of jobsData) {
      const { data: apps } = await supabase
        .from("job_applications")
        .select("id, cleaner_id, status")
        .eq("job_id", job.id);

      const applicants = [];
      for (const app of apps || []) {
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", app.cleaner_id).single();
        applicants.push({ ...app, cleaner_name: profile?.full_name || "Cleaner" });
      }

      jobsWithApplicants.push({ ...job, applicants } as JobWithApplicants);
    }
    setJobs(jobsWithApplicants);
    setLoading(false);
  };

  const hireCleaner = async (jobId: string, cleanerId: string) => {
    await supabase.from("jobs").update({ status: "hired", hired_cleaner_id: cleanerId }).eq("id", jobId);
    await supabase.from("job_applications").update({ status: "hired" }).eq("job_id", jobId).eq("cleaner_id", cleanerId);
    const { data: existing } = await supabase.from("conversations").select("id").eq("job_id", jobId).eq("cleaner_id", cleanerId).maybeSingle();
    if (!existing) {
      await supabase.from("conversations").insert({ job_id: jobId, cleaner_id: cleanerId, owner_id: user!.id });
    }
    toast.success("Cleaner hired!");
    fetchJobs();
  };

  const cancelJob = async (jobId: string) => {
    await supabase.from("jobs").update({ status: "cancelled" }).eq("id", jobId);
    toast.success("Job cancelled");
    fetchJobs();
  };

  const statusConfig: Record<string, { color: string; label: string }> = {
    open: { color: "bg-emerald-100 text-emerald-700", label: "OPEN" },
    applied: { color: "bg-blue-100 text-blue-700", label: "APPLIED" },
    hired: { color: "bg-amber-100 text-amber-700", label: "HIRED" },
    in_progress: { color: "bg-purple-100 text-purple-700", label: "IN PROGRESS" },
    pending_review: { color: "bg-indigo-100 text-indigo-700", label: "PENDING REVIEW" },
    completed: { color: "bg-green-100 text-green-700", label: "COMPLETED" },
    cancelled: { color: "bg-red-100 text-red-700", label: "CANCELLED" },
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-foreground">My Jobs</h1>
        <p className="text-sm text-muted-foreground">Manage your posted jobs</p>
      </div>

      <div className="px-4 space-y-3">
        {loading ? Array.from({ length: 3 }).map((_, i) => <ShimmerCard key={i} />) :
         jobs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No jobs posted yet</p>
          </div>
        ) : jobs.map((job, i) => {
          const status = statusConfig[job.status] || { color: "bg-muted text-muted-foreground", label: job.status.toUpperCase() };
          return (
            <motion.div key={job.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-card rounded-2xl p-4 shadow-card"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-foreground">{job.title}</p>
                  <p className="text-2xl font-bold text-foreground">${job.price}</p>
                </div>
                <Badge className={`${status.color} border-0 text-[10px]`}>{status.label}</Badge>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {job.city || "N/A"}</span>
                <span className="flex items-center gap-1"><Bed className="w-3 h-3" /> {job.bedrooms}</span>
                <span className="flex items-center gap-1"><Bath className="w-3 h-3" /> {job.bathrooms}</span>
              </div>

              {/* Commission breakdown */}
              <div className="bg-accent rounded-xl p-2.5 text-xs space-y-0.5 mb-3">
                <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span>${job.total_amount || job.price}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Platform fee</span><span className="text-destructive">-${job.platform_fee || (job.price * 0.1).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Cleaner gets</span><span className="text-primary font-medium">${job.cleaner_earnings || (job.price * 0.9).toFixed(2)}</span></div>
              </div>

              {/* Applicants */}
              {job.applicants.length > 0 && !["completed", "cancelled"].includes(job.status) && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-1"><Users className="w-3 h-3" /> Applicants ({job.applicants.length})</p>
                  {job.applicants.map(app => (
                    <div key={app.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <span className="text-sm text-foreground">{app.cleaner_name}</span>
                      {job.status === "open" && app.status !== "hired" && (
                        <Button size="sm" onClick={() => hireCleaner(job.id, app.cleaner_id)}
                          className="h-7 text-xs gradient-primary text-primary-foreground rounded-lg">
                          Hire
                        </Button>
                      )}
                      {app.status === "hired" && <Badge className="bg-primary/10 text-primary border-0 text-[10px]">Hired</Badge>}
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                {["hired", "in_progress", "pending_review", "completed"].includes(job.status) && (
                  <Button size="sm" variant="outline" onClick={() => navigate(`/job/${job.id}`)}
                    className="flex-1 h-9 text-xs rounded-xl">
                    <Eye className="w-3 h-3 mr-1" /> View Details
                  </Button>
                )}
                {job.status === "completed" && (
                  <Button size="sm" variant="outline" onClick={() => job.hired_cleaner_id && setReviewJob({ jobId: job.id, reviewedId: job.hired_cleaner_id })}
                    className="flex-1 h-9 text-xs rounded-xl">
                    <Star className="w-3 h-3 mr-1" /> Review
                  </Button>
                )}
                {!["completed", "cancelled", "pending_review"].includes(job.status) && (
                  <Button size="sm" variant="outline" onClick={() => cancelJob(job.id)}
                    className="h-9 text-xs text-destructive border-destructive/30 rounded-xl">
                    <XCircle className="w-3 h-3 mr-1" /> Cancel
                  </Button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {reviewJob && (
        <ReviewModal
          open={!!reviewJob}
          onClose={() => { setReviewJob(null); fetchJobs(); }}
          jobId={reviewJob.jobId}
          reviewedId={reviewJob.reviewedId}
        />
      )}

      <BottomNav />
    </div>
  );
}

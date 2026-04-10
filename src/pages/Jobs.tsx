import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Filter, MapPin, Bed, Bath, Clock, Sparkles, Flame, Eye, Zap, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ShimmerCard from "@/components/ShimmerCard";
import PremiumModal from "@/components/PremiumModal";
import JobConfirmationModal from "@/components/JobConfirmationModal";
import BottomNav from "@/components/BottomNav";
import ReviewModal from "@/components/ReviewModal";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Job {
  id: string;
  owner_id: string;
  title: string;
  cleaning_type: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  address: string | null;
  city: string | null;
  urgency: string;
  status: string;
  description: string | null;
  created_at: string;
  hired_cleaner_id: string | null;
  cleaner_earnings: number;
}

const getTimeSince = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const getFomoBadge = (job: Job) => {
  const diff = Date.now() - new Date(job.created_at).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 10) return { label: "JUST POSTED", icon: Zap, color: "bg-emerald-100 text-emerald-700" };
  if (job.urgency === "urgent") return { label: "URGENT", icon: Flame, color: "bg-red-100 text-red-700" };
  if (job.urgency === "asap") return { label: "ASAP", icon: TrendingUp, color: "bg-amber-100 text-amber-700" };
  if (job.price >= 200) return { label: "HIGH VALUE", icon: Sparkles, color: "bg-purple-100 text-purple-700" };
  return null;
};

export default function Jobs() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [reviewJob, setReviewJob] = useState<{ jobId: string; reviewedId: string } | null>(null);
  const [confirmJob, setConfirmJob] = useState<Job | null>(null);

  useEffect(() => { fetchJobs(); }, []);

  const fetchJobs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("jobs")
      .select("*")
      .in("status", ["open", "hired", "in_progress", "pending_review", "completed"])
      .order("created_at", { ascending: false });
    setJobs((data as Job[]) || []);
    setLoading(false);
  };

  const canAcceptJob = () => {
    if (!profile) return false;
    if (profile.is_premium) return true;
    const today = new Date().toISOString().split("T")[0];
    const usedToday = profile.jobs_used_date === today ? profile.jobs_used_today : 0;
    return usedToday < 2;
  };

  const handleAcceptClick = (job: Job) => {
    if (!user || !profile) return;
    if (!canAcceptJob()) { setShowPaywall(true); return; }
    setConfirmJob(job);
  };

  const confirmAcceptJob = async () => {
    if (!confirmJob || !user || !profile) return;
    const job = confirmJob;
    setAccepting(job.id);
    try {
      await supabase.from("job_applications").insert({ job_id: job.id, cleaner_id: user.id, status: "applied" });
      const today = new Date().toISOString().split("T")[0];
      const currentUsed = profile.jobs_used_date === today ? profile.jobs_used_today : 0;
      await supabase.from("profiles").update({ jobs_used_today: currentUsed + 1, jobs_used_date: today }).eq("id", user.id);

      const { data: existingConv } = await supabase.from("conversations").select("id").eq("job_id", job.id).eq("cleaner_id", user.id).maybeSingle();
      let convId = existingConv?.id;
      if (!convId) {
        const { data: newConv } = await supabase.from("conversations").insert({ job_id: job.id, cleaner_id: user.id, owner_id: job.owner_id }).select("id").single();
        convId = newConv?.id;
      }

      await refreshProfile();
      setConfirmJob(null);
      toast.success("Application sent! 🎉");
      navigate(`/job/${job.id}`);
    } catch { toast.error("Failed to apply"); } finally { setAccepting(null); }
  };

  const filtered = jobs.filter(
    (j) => j.status === "open" && (
      j.title.toLowerCase().includes(search.toLowerCase()) ||
      j.city?.toLowerCase().includes(search.toLowerCase()) ||
      j.cleaning_type.toLowerCase().includes(search.toLowerCase())
    )
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="h-48 gradient-primary relative flex items-end justify-center pb-4 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center opacity-20">
          <MapPin className="w-20 h-20 text-primary-foreground animate-pulse" />
        </div>
        <div className="relative z-10 text-center">
          <h1 className="text-primary-foreground font-bold text-lg">Nearby Jobs</h1>
          <p className="text-primary-foreground/70 text-xs">Find cleaning jobs around you</p>
        </div>
        {filtered.slice(0, 3).map((job, i) => (
          <motion.div key={job.id} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3 + i * 0.15, type: "spring" }}
            className="absolute bg-card text-foreground text-xs font-bold px-2.5 py-1 rounded-full shadow-elevated"
            style={{ top: 30 + i * 30, left: 40 + i * 80 }}>
            ${job.price}
          </motion.div>
        ))}
      </div>

      <div className="px-4 -mt-5 relative z-10">
        <div className="bg-card rounded-2xl shadow-card flex items-center px-4 gap-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search jobs..." value={search} onChange={(e) => setSearch(e.target.value)} className="border-0 bg-transparent h-12 focus-visible:ring-0 pl-0" />
          <button onClick={() => setShowFilters(!showFilters)} className="text-muted-foreground hover:text-primary transition-colors"><Filter className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Job count */}
      {!loading && filtered.length > 0 && (
        <div className="px-4 mt-3">
          <p className="text-xs text-muted-foreground">{filtered.length} jobs available near you</p>
        </div>
      )}

      <div className="px-4 mt-3 space-y-3">
        {loading ? Array.from({ length: 3 }).map((_, i) => <ShimmerCard key={i} />) :
         filtered.length === 0 ? (
          <div className="text-center py-12">
            <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No jobs available</p>
            <p className="text-xs text-muted-foreground mt-1">Check back soon for new opportunities</p>
          </div>
        ) : filtered.map((job, i) => {
          const fomo = getFomoBadge(job);
          const isRecent = Date.now() - new Date(job.created_at).getTime() < 600000; // 10 min

          return (
            <motion.div key={job.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, type: "spring", stiffness: 300, damping: 30 }}
              className={`bg-card rounded-2xl p-4 shadow-card active:scale-[0.98] transition-all ${isRecent ? "ring-2 ring-primary/20" : ""}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-2xl font-bold text-foreground">${job.price}</p>
                  <p className="text-sm text-muted-foreground">{job.title}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {fomo && (
                    <Badge className={`${fomo.color} border-0 text-[10px] flex items-center gap-1`}>
                      <fomo.icon className="w-3 h-3" /> {fomo.label}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground mb-1">
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {job.city || "N/A"}</span>
                <span className="flex items-center gap-1"><Bed className="w-3 h-3" /> {job.bedrooms}</span>
                <span className="flex items-center gap-1"><Bath className="w-3 h-3" /> {job.bathrooms}</span>
                <Badge variant="outline" className="text-[10px]">{job.cleaning_type}</Badge>
              </div>

              <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-3">
                <Clock className="w-3 h-3" />
                <span>{getTimeSince(job.created_at)}</span>
                {isRecent && <span className="text-primary font-medium">• New</span>}
              </div>

              {profile?.role === "cleaner" && (
                <Button onClick={() => handleAcceptClick(job)} disabled={accepting === job.id}
                  className="w-full h-10 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm hover:opacity-90 active:scale-[0.97] transition-transform">
                  {accepting === job.id ? "Applying..." : "Apply for Job"}
                </Button>
              )}
            </motion.div>
          );
        })}
      </div>

      <PremiumModal open={showPaywall} onClose={() => setShowPaywall(false)} message="You've reached your daily limit of 2 jobs. Start your 7-day free trial to unlock unlimited jobs." />
      {reviewJob && <ReviewModal open={!!reviewJob} onClose={() => setReviewJob(null)} jobId={reviewJob.jobId} reviewedId={reviewJob.reviewedId} />}
      {confirmJob && (
        <JobConfirmationModal
          open={!!confirmJob}
          onClose={() => setConfirmJob(null)}
          onConfirm={confirmAcceptJob}
          loading={accepting === confirmJob.id}
          jobTitle={confirmJob.title}
          jobPrice={confirmJob.price}
        />
      )}
      <BottomNav />
    </div>
  );
}

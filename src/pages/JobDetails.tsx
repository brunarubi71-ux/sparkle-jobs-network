import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sendNotification, sendNotifications } from "@/lib/notifications";
import { useAuth } from "@/hooks/useAuth";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, MapPin, Bed, Bath, Camera, CheckCircle,
  Image as ImageIcon, Play, Lock, Sparkles, Clock, Home, ImagePlus, Users, Calendar, Unlock, Key, X,
  MessageCircle, Star
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import BottomNav from "@/components/BottomNav";
import ReviewModal from "@/components/ReviewModal";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import { syncBadges } from "@/lib/badges";

/** Worker's estimated earnings: 90% of job price split equally between all workers. */
const getWorkerEarnings = (job: { price: number; cleaners_required?: number | null; helpers_required?: number | null }) => {
  const workers = Math.max(1, (job.cleaners_required ?? 1) + (job.helpers_required ?? 0));
  return (Number(job.price || 0) * 0.9) / workers;
};

export default function JobDetails() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [job, setJob] = useState<any>(null);
  const [ownerVerified, setOwnerVerified] = useState(false);
  const [ownerProfile, setOwnerProfile] = useState<{ id: string; full_name: string | null; avatar_url: string | null } | null>(null);
  const [hiredCleaner, setHiredCleaner] = useState<{ id: string; full_name: string | null; avatar_url: string | null; avg_rating: number | null } | null>(null);
  const [teamMembers, setTeamMembers] = useState<{ id: string; full_name: string | null; avatar_url: string | null; worker_type: "cleaner" | "helper" }[]>([]);
  const [loading, setLoading] = useState(true);
  const [completionPhotos, setCompletionPhotos] = useState<string[]>([]);
  const [photoCaptions, setPhotoCaptions] = useState<Record<string, string>>({});
  const [completionNotes, setCompletionNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const MIN_COMPLETION_PHOTOS = 10;
  const [startingJob, setStartingJob] = useState(false);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);

  useEffect(() => { if (id) fetchJob(); }, [id]);
  useEffect(() => {
    if (job?.status === "completed" && user && id) {
      supabase.from("reviews").select("id").eq("job_id", id).eq("reviewer_id", user.id).maybeSingle()
        .then(({ data }) => setHasReviewed(!!data));
    }
  }, [job?.status, user, id]);

  const fetchJob = async () => {
    setLoading(true);
    const { data } = await supabase.from("jobs").select("*").eq("id", id!).single();
    if (data) {
      // Stakeholders (owner / hired cleaner / accepted applicant) get the
      // private details row; everyone else hits RLS and gets `null`.
      const { data: priv } = await supabase
        .from("job_private_details" as any)
        .select("*")
        .eq("job_id", id!)
        .maybeSingle();
      const merged = { ...(data as any), ...((priv as any) || {}) };
      setJob(merged);
      setCompletionPhotos((merged as any).completion_photos || []);
      setCompletionNotes((merged as any).completion_notes || "");
      // Fetch owner profile + verification status
      const { data: ownerData } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, identity_status")
        .eq("id", (data as any).owner_id)
        .maybeSingle();
      setOwnerVerified((ownerData as any)?.identity_status === "approved");
      if (ownerData) {
        setOwnerProfile({
          id: (ownerData as any).id,
          full_name: (ownerData as any).full_name,
          avatar_url: (ownerData as any).avatar_url,
        });
      }

      // Fetch hired cleaner profile + avg rating
      const cleanerId = (data as any).hired_cleaner_id;
      if (cleanerId) {
        const [{ data: cp }, { data: revs }] = await Promise.all([
          supabase.from("profiles").select("id, full_name, avatar_url").eq("id", cleanerId).maybeSingle(),
          supabase.from("reviews").select("rating").eq("reviewed_id", cleanerId).eq("is_hidden", false),
        ]);
        const ratings = (revs || []).map((r: any) => r.rating);
        const avg = ratings.length
          ? Math.round((ratings.reduce((s: number, n: number) => s + n, 0) / ratings.length) * 10) / 10
          : null;
        if (cp) setHiredCleaner({ id: (cp as any).id, full_name: (cp as any).full_name, avatar_url: (cp as any).avatar_url, avg_rating: avg });
      } else {
        setHiredCleaner(null);
      }

      // Fetch team members (accepted job_applications) for team jobs
      const cleanersReq = (data as any).cleaners_required ?? 1;
      const helpersReq = (data as any).helpers_required ?? 0;
      const totalReq = cleanersReq + helpersReq;
      if (totalReq >= 2) {
        const { data: apps } = await supabase
          .from("job_applications")
          .select("cleaner_id, status")
          .eq("job_id", (data as any).id)
          .eq("status", "accepted");
        const ids = (apps || []).map((a: any) => a.cleaner_id);
        if (ids.length > 0) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url, worker_type")
            .in("id", ids);
          setTeamMembers(
            (profs || []).map((p: any) => ({
              id: p.id,
              full_name: p.full_name,
              avatar_url: p.avatar_url,
              worker_type: p.worker_type === "helper" ? "helper" : "cleaner",
            }))
          );
        } else {
          setTeamMembers([]);
        }
      } else {
        setTeamMembers([]);
      }
    }
    setLoading(false);
  };

  const isOwner = job?.owner_id === user?.id;
  const isHiredLead = job?.hired_cleaner_id === user?.id;
  const isTeamMember = !!user && teamMembers.some(m => m.id === user.id);
  // Any hired team member (lead cleaner or accepted helper/cleaner) can act as the worker
  const isCleaner = isHiredLead || isTeamMember;
  const isStarted = ["in_progress", "pending_review", "completed"].includes(job?.status);

  // Solo start logic: helpers required but none accepted yet
  const helpersRequired = job?.helpers_required ?? 0;
  const helpersAccepted = teamMembers.filter(m => m.worker_type === "helper").length;
  const helperMissing = helpersRequired >= 1 && helpersAccepted < helpersRequired;
  const allowSoloStart = !!job?.allow_solo_start;
  const startBlockedByMissingHelper = helperMissing && !allowSoloStart;

  const approveSoloStart = async () => {
    if (!id) return;
    const { error } = await supabase.from("jobs").update({ allow_solo_start: true } as any).eq("id", id);
    if (error) { toast.error("Could not approve solo start"); return; }
    toast.success("Solo start approved — Cleaner can begin without Helper");
    await fetchJob();
  };

  const startJob = async () => {
    if (!id) return;
    if (startBlockedByMissingHelper) {
      toast.error("Waiting for Helper to be hired or Owner approval");
      return;
    }
    setStartingJob(true);
    await supabase.from("jobs").update({ status: "in_progress" }).eq("id", id);
    toast.success(t("job.started_success"));
    await fetchJob();
    setStartingJob(false);
  };

  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);

  const uploadCompletionPhotos = async (files: File[]) => {
    if (!user || !id || files.length === 0) return;
    setUploading(true);
    setUploadProgress({ done: 0, total: files.length });
    const baseIndex = completionPhotos.length;
    const newUrls: string[] = [];
    let failed = 0;
    let completed = 0;

    const uploadOne = async (file: File, offset: number) => {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${id}/completion/foto_${baseIndex + offset + 1}_${Date.now()}_${offset}.${ext}`;
      const { error } = await supabase.storage.from("property-photos").upload(path, file);
      completed += 1;
      setUploadProgress({ done: completed, total: files.length });
      if (error) {
        console.error("[JobDetails] photo upload failed:", error);
        failed += 1;
        return null;
      }
      const { data: { publicUrl } } = supabase.storage.from("property-photos").getPublicUrl(path);
      return publicUrl;
    };

    const results = await Promise.all(files.map((f, i) => uploadOne(f, i)));
    for (const url of results) if (url) newUrls.push(url);

    if (newUrls.length > 0) {
      const updated = [...completionPhotos, ...newUrls];
      await supabase.from("jobs").update({ completion_photos: updated }).eq("id", id);
      setCompletionPhotos(updated);
      toast.success(
        newUrls.length === 1
          ? t("job.photo_uploaded")
          : `${newUrls.length} photos uploaded`
      );
    }
    if (failed > 0) toast.error(t("job.upload_failed"));
    setUploading(false);
    setUploadProgress(null);
  };

  const uploadCompletionPhoto = (file: File) => uploadCompletionPhotos([file]);

  const removeCompletionPhoto = async (url: string) => {
    if (!id) return;
    const updated = completionPhotos.filter(p => p !== url);
    setCompletionPhotos(updated);
    setPhotoCaptions(prev => {
      const next = { ...prev };
      delete next[url];
      return next;
    });
    await supabase.from("jobs").update({ completion_photos: updated }).eq("id", id);
    // Best-effort delete from storage (path is the part after the bucket public URL)
    try {
      const marker = "/property-photos/";
      const idx = url.indexOf(marker);
      if (idx !== -1) {
        const path = url.substring(idx + marker.length);
        await supabase.storage.from("property-photos").remove([path]);
      }
    } catch (e) {
      console.error("[JobDetails] photo delete failed:", e);
    }
  };

  const submitCompletion = async () => {
    if (!id) return;
    if (completionPhotos.length < MIN_COMPLETION_PHOTOS) {
      toast.error(`Please add at least ${MIN_COMPLETION_PHOTOS} photos to complete this job.`);
      return;
    }
    setCompleting(true);
    // Append captions to notes (so they persist without a schema change)
    const captionLines = completionPhotos
      .map((url, i) => {
        const cap = (photoCaptions[url] || "").trim();
        return cap ? `Photo ${i + 1}: ${cap}` : null;
      })
      .filter(Boolean) as string[];
    const finalNotes = captionLines.length > 0
      ? `${completionNotes}${completionNotes ? "\n\n" : ""}— Photo captions —\n${captionLines.join("\n")}`
      : completionNotes;
    await supabase.from("jobs").update({ status: "pending_review", completion_photos: completionPhotos, completion_notes: finalNotes, pending_review_at: new Date().toISOString() } as any).eq("id", id);
    toast.success(t("job.submitted_review"));
    await fetchJob();
    setCompleting(false);
  };

  const confirmCompletion = async () => {
    if (!id || !job) return;
    await supabase.from("jobs").update({ status: "completed", owner_confirmed_completion: true }).eq("id", id);

    // ----- "Job Approved 🎉" notifications for ALL hired workers -----
    try {
      const approvedIds = new Set<string>();
      if (job.hired_cleaner_id) approvedIds.add(job.hired_cleaner_id);
      const { data: approvedApps } = await supabase
        .from("job_applications")
        .select("cleaner_id")
        .eq("job_id", id)
        .eq("status", "accepted");
      (approvedApps || []).forEach((a: any) => { if (a.cleaner_id) approvedIds.add(a.cleaner_id); });

      if (approvedIds.size > 0) {
        await sendNotifications(
          Array.from(approvedIds).map((uid) => ({
            userId: uid,
            title: "Job Approved 🎉",
            message: `Your work on "${job.title}" has been approved! Payment is being processed.`,
            type: "job_approved",
            relatedId: id,
            link: `/job/${id}`,
          })),
        );
      }
    } catch (e) {
      console.error("[JobDetails] job_approved batch failed", e);
    }

    // ----- Payment split: 10% platform fee, 90% split equally among ALL hired workers -----
    const total = Number(job.total_amount || job.price || 0);
    const platformFee = Math.round(total * 0.10 * 100) / 100;
    const workerPool = Math.round((total - platformFee) * 100) / 100;

    // Collect all hired workers: lead cleaner + accepted team members (deduped)
    const hiredIds = new Set<string>();
    if (job.hired_cleaner_id) hiredIds.add(job.hired_cleaner_id);
    try {
      const { data: acceptedApps } = await supabase
        .from("job_applications")
        .select("cleaner_id")
        .eq("job_id", id)
        .eq("status", "accepted");
      (acceptedApps || []).forEach((a: any) => { if (a.cleaner_id) hiredIds.add(a.cleaner_id); });
    } catch {}

    const workerIds = Array.from(hiredIds);
    const perWorker = workerIds.length > 0
      ? Math.round((workerPool / workerIds.length) * 100) / 100
      : 0;

    // Update each worker's profile + atomically credit their wallet
    for (const workerId of workerIds) {
      try {
        const { data: wp } = await supabase
          .from("profiles")
          .select("jobs_completed, total_earnings, worker_type")
          .eq("id", workerId)
          .single();
        if (!wp) continue;
        const newJobs = (wp.jobs_completed || 0) + 1;
        const newEarnings = Math.round((Number(wp.total_earnings || 0) + perWorker) * 100) / 100;
        await supabase.from("profiles").update({
          jobs_completed: newJobs,
          total_earnings: newEarnings,
        } as any).eq("id", workerId);

        // Atomic credit (handles concurrent updates safely)
        await supabase.rpc("credit_wallet", {
          p_user_id: workerId,
          p_amount: perWorker,
          p_description: `Earnings from "${job.title}"`,
          p_job_id: id,
        });

        // Payment Received notification for this worker
        await sendNotification({
          userId: workerId,
          title: "Payment Received 💰",
          message: `You received $${perWorker.toFixed(2)} for completing "${job.title}"!`,
          type: "payment_received",
          relatedId: id,
          link: "/wallet",
        });

        const workerType = ((wp as any).worker_type === "helper" ? "helper" : "cleaner") as "helper" | "cleaner";
        const { data: revs } = await supabase.from("reviews").select("rating").eq("reviewed_id", workerId).eq("is_hidden", false);
        const avg = revs && revs.length ? revs.reduce((s, r) => s + r.rating, 0) / revs.length : 0;
        await syncBadges(workerId, { jobsCompleted: newJobs, avgRating: avg, totalEarnings: newEarnings }, workerType);
      } catch (e) {
        console.error("[JobDetails] payout error for worker", workerId, e);
      }
    }

    // Record platform fee transaction (against owner)
    if (platformFee > 0 && job.owner_id) {
      try {
        await supabase.from("wallet_transactions" as any).insert({
          user_id: job.owner_id,
          amount: platformFee,
          type: "platform_fee",
          description: `Platform fee (10%) for "${job.title}"`,
          job_id: id,
        });
      } catch (e) {
        console.error("[JobDetails] platform fee record failed", e);
      }
    }

    setShowPaymentSuccess(true);
    setTimeout(() => setShowPaymentSuccess(false), 3000);
    toast.success(t("job.completion_confirmed"));
    await fetchJob();
  };

  const statusConfig: Record<string, { color: string; label: string; icon: string }> = {
    open: { color: "bg-emerald-100 text-emerald-700", label: t("status.open"), icon: "🟢" },
    applied: { color: "bg-blue-100 text-blue-700", label: t("status.applied"), icon: "📋" },
    accepted: { color: "bg-amber-100 text-amber-700", label: t("status.accepted"), icon: "🤝" },
    hired: { color: "bg-amber-100 text-amber-700", label: t("status.hired"), icon: "🤝" },
    in_progress: { color: "bg-purple-100 text-purple-700", label: t("status.in_progress"), icon: "🔧" },
    pending_review: { color: "bg-indigo-100 text-indigo-700", label: t("status.pending_review"), icon: "⏳" },
    completed: { color: "bg-green-100 text-green-700", label: t("status.completed"), icon: "✅" },
    cancelled: { color: "bg-red-100 text-red-700", label: t("status.cancelled"), icon: "❌" },
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!job) return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">{t("job.not_found")}</p></div>;

  const status = statusConfig[job.status] || { color: "bg-muted text-muted-foreground", label: job.status.toUpperCase(), icon: "📌" };
  const propertyPhotos: string[] = job.property_photos || [];
  const mainPhoto: string | null = (job as any).main_property_photo;
  const isAirbnb = job.cleaning_type === "airbnb";

  // Structured access fields
  const accessFields = [
    { label: t("post.door_code"), value: (job as any).door_code },
    { label: t("post.supply_code"), value: (job as any).supply_code },
    { label: t("post.lockbox_code"), value: (job as any).lockbox_code },
    { label: t("post.gate_code"), value: (job as any).gate_code },
    { label: t("post.alarm_instructions"), value: (job as any).alarm_instructions },
    { label: t("post.parking_instructions"), value: (job as any).parking_instructions },
    { label: t("post.additional_notes"), value: job.door_access_info },
  ].filter((f) => f.value);

  const hasAccessInfo = accessFields.length > 0;
  const hasAdditionalPhotos = propertyPhotos.length > 0;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="gradient-primary px-4 py-4 flex items-center gap-3 shadow-md">
        <button onClick={() => navigate(-1)} className="text-white"><ArrowLeft className="w-5 h-5" /></button>
        <h2 className="font-bold text-white flex-1 text-lg">
          {isCleaner ? t("job.execution") : t("job.details")}
        </h2>
        <Badge className={`${status.color} border-0 text-[10px] font-bold`}>{status.icon} {status.label}</Badge>
      </div>

      <AnimatePresence>
        {showPaymentSuccess && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-20">
            <div className="bg-emerald-500 text-white px-6 py-4 rounded-2xl shadow-elevated flex items-center gap-3">
              <Sparkles className="w-5 h-5" />
              <span className="font-semibold">{t("job.payment_released_short")}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-4 py-4 space-y-4">
        {/* Main Property Photo (cleaner view) */}
        {isCleaner && mainPhoto && (
          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
            <div className="rounded-2xl overflow-hidden border border-border shadow-card">
              <img src={mainPhoto} alt={job.title} className="w-full aspect-video object-cover" />
            </div>
          </motion.div>
        )}

        {/* Job Summary */}
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-card rounded-2xl shadow-card p-5">
          <div className="flex items-start justify-between mb-2 gap-3">
            <h1 className="text-xl font-bold text-foreground flex-1">{job.title}</h1>
            {profile?.role === "cleaner" && !isOwner ? (
              <div className="text-right">
                <span className="block text-2xl font-bold text-emerald-600">${getWorkerEarnings(job).toFixed(2)}</span>
                <span className="block text-[11px] font-medium text-muted-foreground">Your earnings</span>
              </div>
            ) : (
              <span className="text-2xl font-bold text-primary">${job.price}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-3">
            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {job.city || "N/A"}</span>
            <span className="flex items-center gap-1"><Bed className="w-3.5 h-3.5" /> {job.bedrooms} {t("common.bed")}</span>
            <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5" /> {job.bathrooms} {t("common.bath")}</span>
            <Badge variant="outline" className="text-[10px]">{job.cleaning_type}</Badge>
            {ownerVerified && !isOwner && (
              <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px] hover:bg-emerald-100">
                🏠 ✓ Verified Owner
              </Badge>
            )}
          </div>
          {isOwner && job.date_time && (
            <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              {new Date(job.date_time).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            </p>
          )}
          {job.address && <p className="text-sm text-muted-foreground mb-2"><MapPin className="w-3.5 h-3.5 inline mr-1 text-primary" />{job.address}</p>}
          {job.description && <p className="text-sm text-foreground/80 leading-relaxed">{job.description}</p>}

          {/* Airbnb info */}
          {isAirbnb && ((job as any).number_of_guests || (job as any).guest_stay_length) && (
            <div className="mt-3 bg-primary/5 rounded-xl p-3 border border-primary/10 flex gap-4 text-xs">
              {(job as any).number_of_guests && (
                <span className="flex items-center gap-1 text-foreground"><Users className="w-3.5 h-3.5 text-primary" /> {(job as any).number_of_guests} {t("job.guests")}</span>
              )}
              {(job as any).guest_stay_length && (
                <span className="flex items-center gap-1 text-foreground"><Calendar className="w-3.5 h-3.5 text-primary" /> {(job as any).guest_stay_length} {t("job.days_stayed")}</span>
              )}
            </div>
          )}
        </motion.div>

        {/* Cleaner: Posted by (owner) card */}
        {!isOwner && ownerProfile && (
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.03 }}
            className="bg-card rounded-2xl shadow-card p-4"
          >
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Home className="w-4 h-4 text-primary" /> Posted by
            </h3>
            <button
              onClick={() => navigate(`/profile/${ownerProfile.id}`)}
              className="flex items-center gap-3 w-full text-left hover:opacity-80 transition-opacity"
            >
              <div className="w-12 h-12 rounded-full bg-accent overflow-hidden flex-shrink-0">
                {ownerProfile.avatar_url ? (
                  <img src={ownerProfile.avatar_url} alt={ownerProfile.full_name || "Owner"} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-primary font-bold">
                    {(ownerProfile.full_name || "?").charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate hover:text-primary">
                  {ownerProfile.full_name || "Owner"}
                </p>
                {ownerVerified && (
                  <p className="text-xs text-emerald-600 flex items-center gap-1">
                    🏠 ✓ Verified Owner
                  </p>
                )}
              </div>
            </button>
          </motion.div>
        )}

        {/* Team job: requirements + roster */}
        {((job.cleaners_required ?? 1) + (job.helpers_required ?? 0) >= 2) && (() => {
          const cleanersReq = job.cleaners_required ?? 1;
          const helpersReq = job.helpers_required ?? 0;
          const required = cleanersReq + helpersReq;
          const cleaners = teamMembers.filter(m => m.worker_type === "cleaner");
          const helpers = teamMembers.filter(m => m.worker_type === "helper");
          const filled = teamMembers.length;
          const pct = Math.min(100, (filled / required) * 100);
          const complete = filled >= required;

          const renderMember = (m: typeof teamMembers[number], badge: string) => (
            <button
              key={m.id}
              onClick={() => navigate(`/profile/${m.id}`)}
              className="flex items-center gap-2 w-full text-left bg-accent/40 hover:bg-accent rounded-xl px-3 py-2 transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-accent overflow-hidden flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                {m.avatar_url ? (
                  <img src={m.avatar_url} alt={m.full_name || ""} className="w-full h-full object-cover" />
                ) : (
                  (m.full_name || "?").charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{m.full_name || "Worker"}</p>
                <p className="text-[10px] text-muted-foreground">{badge}</p>
              </div>
            </button>
          );

          const parts: string[] = [];
          if (cleanersReq > 0) parts.push(`${cleanersReq} Cleaner${cleanersReq > 1 ? "s" : ""}`);
          if (helpersReq > 0) parts.push(`${helpersReq} Helper${helpersReq > 1 ? "s" : ""}`);

          return (
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.035 }}
              className="bg-card rounded-2xl shadow-card p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" /> Team Job
                </h3>
                <Badge className={`border-0 text-[10px] font-bold ${complete ? "bg-emerald-100 text-emerald-700" : "bg-primary/10 text-primary"}`}>
                  {filled}/{required} filled
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Needs <span className="font-semibold text-foreground">{parts.join(" + ")}</span>
              </p>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-4">
                <div
                  className={`h-full transition-all ${complete ? "bg-emerald-500" : "bg-primary"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="space-y-3">
                {cleanersReq > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                      🚗 Cleaners ({cleaners.length}/{cleanersReq})
                    </p>
                    {cleaners.length > 0
                      ? <div className="space-y-1.5">{cleaners.map(m => renderMember(m, "Cleaner"))}</div>
                      : <p className="text-xs text-muted-foreground italic px-1">Spot still open</p>}
                  </div>
                )}
                {helpersReq > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                      🤝 Helpers ({helpers.length}/{helpersReq})
                    </p>
                    {helpers.length > 0
                      ? <div className="space-y-1.5">{helpers.map(m => renderMember(m, "Helper"))}</div>
                      : <p className="text-xs text-muted-foreground italic px-1">Spots still open</p>}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })()}

        {/* Owner: Hired cleaner card */}
        {isOwner && hiredCleaner && (
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.04 }}
            className="bg-card rounded-2xl shadow-card p-4"
          >
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> Your Cleaner
            </h3>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-accent overflow-hidden flex-shrink-0">
                {hiredCleaner.avatar_url ? (
                  <img src={hiredCleaner.avatar_url} alt={hiredCleaner.full_name || "Cleaner"} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-primary font-bold">
                    {(hiredCleaner.full_name || "?").charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <button
                onClick={() => navigate(`/profile/${hiredCleaner.id}`)}
                className="flex-1 text-left min-w-0"
              >
                <p className="text-sm font-semibold text-foreground truncate">
                  {hiredCleaner.full_name || "Cleaner"}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  {hiredCleaner.avg_rating != null ? hiredCleaner.avg_rating.toFixed(1) : "No ratings yet"}
                </p>
              </button>
              <Button
                size="sm"
                onClick={async () => {
                  if (!user || !hiredCleaner) return;
                  // Find or create conversation between owner and hired cleaner for this job
                  const { data: existing } = await supabase
                    .from("conversations")
                    .select("id")
                    .eq("owner_id", user.id)
                    .eq("cleaner_id", hiredCleaner.id)
                    .eq("job_id", job.id)
                    .maybeSingle();
                  let convId = (existing as any)?.id;
                  if (!convId) {
                    const { data: created, error } = await supabase
                      .from("conversations")
                      .insert({ owner_id: user.id, cleaner_id: hiredCleaner.id, job_id: job.id })
                      .select("id")
                      .single();
                    if (error) {
                      toast.error("Could not open chat");
                      return;
                    }
                    convId = (created as any).id;
                  }
                  navigate(`/chat/${convId}`);
                }}
                className="rounded-full gradient-primary text-white h-9 px-4"
              >
                <MessageCircle className="w-4 h-4 mr-1.5" /> Message
              </Button>
            </div>
          </motion.div>
        )}

        {/* Owner: Allow Solo Start (helper missing) */}
        {isOwner && job.status === "hired" && helperMissing && (
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-card rounded-2xl shadow-card p-4 border-l-4 border-l-amber-400"
          >
            <h3 className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-500" /> Helper not yet hired
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              You can let the Cleaner begin the job alone instead of waiting for a Helper.
            </p>
            <Button
              onClick={approveSoloStart}
              disabled={allowSoloStart}
              className={`w-full h-11 rounded-xl font-semibold ${
                allowSoloStart
                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 cursor-default"
                  : "gradient-primary text-white"
              }`}
            >
              {allowSoloStart ? "✓ Solo start approved" : "Allow solo start (Cleaner can begin without Helper)"}
            </Button>
          </motion.div>
        )}

        {isOwner && (
          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 }} className="space-y-4">
            {mainPhoto && (
              <div className="bg-card rounded-2xl shadow-card p-5">
                <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <Home className="w-4 h-4 text-primary" /> {t("post.main_photo")}
                </h3>
                <div className="rounded-xl overflow-hidden border border-border">
                  <img src={mainPhoto} alt="" className="w-full aspect-video object-cover" />
                </div>
              </div>
            )}
            {hasAccessInfo && (
              <div className="bg-card rounded-2xl shadow-card p-5">
                <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <Key className="w-4 h-4 text-primary" /> {t("post.access_details")}
                </h3>
                <div className="space-y-2">
                  {accessFields.map((f, i) => (
                    <div key={i} className="flex justify-between bg-accent/50 rounded-lg px-3 py-2">
                      <span className="text-xs text-muted-foreground">{f.label}</span>
                      <span className="text-xs font-medium text-foreground">{f.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {hasAdditionalPhotos && (
              <div className="bg-card rounded-2xl shadow-card p-5">
                <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-primary" /> {t("post.additional_photos")}
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {propertyPhotos.map((url, i) => (
                    <img key={i} src={url} className="w-full aspect-square object-cover rounded-xl border border-border" alt={`Photo ${i + 1}`} />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Cleaner: General Info */}
        {isCleaner && job.owner_instructions && (
          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 }}>
            <div className="bg-card rounded-2xl shadow-card p-5">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
                <Home className="w-4 h-4 text-primary" /> {t("job.general_info")}
              </h3>
              <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{job.owner_instructions}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Cleaner: Access Section — Locked or Unlocked */}
        {isCleaner && (hasAccessInfo || hasAdditionalPhotos) && (
          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
            {!isStarted ? (
              /* LOCKED STATE */
              <div className="bg-card rounded-2xl shadow-card p-5 border-l-4 border-l-amber-400">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
                  <Lock className="w-4 h-4 text-amber-500" /> {t("job.access_locked")}
                </h3>
                <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-4 border border-amber-200 dark:border-amber-800 text-center">
                  <Lock className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                  <p className="text-sm text-foreground font-medium">{t("job.unlock_message")}</p>
                </div>
              </div>
            ) : (
              /* UNLOCKED STATE */
              <div className="space-y-4">
                {hasAccessInfo && (
                  <div className="bg-card rounded-2xl shadow-card p-5 border-l-4 border-l-emerald-400">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
                      <Unlock className="w-4 h-4 text-emerald-500" /> {t("job.access_unlocked")}
                    </h3>
                    <div className="space-y-2">
                      {accessFields.map((f, i) => (
                        <div key={i} className="flex justify-between bg-emerald-50 dark:bg-emerald-950/30 rounded-lg px-3 py-2.5 border border-emerald-200 dark:border-emerald-800">
                          <span className="text-xs text-muted-foreground">{f.label}</span>
                          <span className="text-sm font-semibold text-foreground">{f.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {hasAdditionalPhotos && (
                  <div className="bg-card rounded-2xl shadow-card p-5">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
                      <Camera className="w-4 h-4 text-primary" /> {t("post.additional_photos")}
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                      {propertyPhotos.map((url, i) => (
                        <img key={i} src={url} className="w-full aspect-square object-cover rounded-xl border border-border" alt={`Reference ${i + 1}`} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* Cleaner: Start Job */}
        {isCleaner && ["accepted", "hired"].includes(job.status) && (
          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
            <Button
              onClick={startJob}
              disabled={startingJob || startBlockedByMissingHelper}
              title={startBlockedByMissingHelper ? "Waiting for Helper to be hired or Owner approval" : undefined}
              className="w-full h-16 rounded-2xl gradient-primary text-white font-bold text-lg shadow-[0_4px_14px_0_hsla(271,91%,65%,0.4)] hover:shadow-[0_6px_20px_0_hsla(271,91%,65%,0.5)] hover:opacity-95 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-6 h-6 mr-2" />
              {startingJob ? t("job.starting") : t("job.start")}
            </Button>
            {startBlockedByMissingHelper && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 text-center">
                ⏳ Waiting for Helper to be hired or Owner approval
              </p>
            )}
            {helperMissing && allowSoloStart && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 text-center font-medium">
                ✓ Owner approved solo start
              </p>
            )}
          </motion.div>
        )}

        {/* Cleaner: Work Execution */}
        {isCleaner && job.status === "in_progress" && (
          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="space-y-4">
            <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
              <p className="text-sm font-semibold text-primary">{t("job.in_progress")}</p>
            </div>

            <div className="bg-card rounded-2xl shadow-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Camera className="w-4 h-4 text-primary" /> {t("job.work_proof")}
                </h3>
                <label className="text-xs text-primary cursor-pointer font-semibold flex items-center gap-1 bg-primary/10 px-3 py-1.5 rounded-full hover:bg-primary/20 transition-colors">
                  <ImagePlus className="w-3.5 h-3.5" /> {t("job.add_photo")}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const files = e.target.files ? Array.from(e.target.files) : [];
                      if (files.length > 0) uploadCompletionPhotos(files);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>

              {/* Photo counter */}
              {(() => {
                const count = completionPhotos.length;
                const reached = count >= MIN_COMPLETION_PHOTOS;
                const pct = Math.min(100, (count / MIN_COMPLETION_PHOTOS) * 100);
                return (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-xs font-semibold ${reached ? "text-emerald-600" : "text-muted-foreground"}`}>
                        {count}/{MIN_COMPLETION_PHOTOS} photos required
                      </span>
                      {reached && (
                        <span className="text-[10px] font-medium text-emerald-600 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Ready to finish
                        </span>
                      )}
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full transition-all ${reached ? "bg-emerald-500" : "bg-primary"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })()}

              {completionPhotos.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {completionPhotos.map((url, i) => {
                    const caption = photoCaptions[url] || "";
                    return (
                      <div key={url} className="space-y-1">
                        <div className="relative group">
                          <motion.img
                            src={url}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="w-full aspect-square object-cover rounded-xl border border-border"
                            alt={`Work photo ${i + 1}`}
                          />
                          <button
                            type="button"
                            onClick={() => removeCompletionPhoto(url)}
                            aria-label="Remove photo"
                            className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md hover:scale-110 transition-transform"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <input
                          type="text"
                          maxLength={30}
                          value={caption}
                          onChange={(e) =>
                            setPhotoCaptions(prev => ({ ...prev, [url]: e.target.value }))
                          }
                          placeholder="Caption (optional)"
                          className="w-full text-[10px] px-2 py-1 rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="border-2 border-dashed border-primary/20 rounded-xl p-8 text-center bg-primary/5">
                  <ImageIcon className="w-10 h-10 text-primary/40 mx-auto mb-2" />
                  <p className="text-sm text-foreground font-medium">{t("job.upload_work_photos")}</p>
                  <p className="text-xs text-muted-foreground mt-1">At least {MIN_COMPLETION_PHOTOS} photos required</p>
                </div>
              )}

              {uploading && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-muted-foreground">
                      {uploadProgress && uploadProgress.total > 1
                        ? `${t("job.uploading")} ${uploadProgress.done}/${uploadProgress.total}`
                        : t("job.uploading")}
                    </span>
                  </div>
                  {uploadProgress && uploadProgress.total > 1 && (
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${(uploadProgress.done / uploadProgress.total) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">{t("job.completion_notes")}</label>
                <Textarea placeholder={t("job.completion_notes_placeholder")} value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)} className="rounded-xl min-h-[60px]" />
              </div>
            </div>

            <Button
              onClick={submitCompletion}
              disabled={completing || completionPhotos.length < MIN_COMPLETION_PHOTOS}
              className="w-full h-16 rounded-2xl bg-emerald-500 text-white hover:bg-emerald-600 font-bold text-lg shadow-[0_4px_14px_0_rgba(16,185,129,0.3)] transition-all active:scale-[0.98] disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
            >
              <CheckCircle className="w-6 h-6 mr-2" />
              {completing
                ? t("job.submitting")
                : completionPhotos.length < MIN_COMPLETION_PHOTOS
                ? `${t("job.mark_finished")} (${completionPhotos.length}/${MIN_COMPLETION_PHOTOS})`
                : t("job.mark_finished")}
            </Button>
          </motion.div>
        )}

        {/* Cleaner: Pending Review */}
        {isCleaner && job.status === "pending_review" && (
          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-3">
              <Clock className="w-7 h-7 text-indigo-500" />
            </div>
            <h3 className="font-bold text-foreground mb-1">{t("job.pending_review")}</h3>
            <p className="text-sm text-muted-foreground">{t("job.pending_review_desc")}</p>
          </motion.div>
        )}

        {/* Cleaner: Completed */}
        {isCleaner && job.status === "completed" && (
          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="space-y-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-7 h-7 text-emerald-500" />
              </div>
              <h3 className="font-bold text-foreground mb-1">{t("job.completed")}</h3>
              <p className="text-sm text-muted-foreground">{t("job.payment_released")}</p>
            </div>
            {!hasReviewed && job.owner_id && (
              <Button onClick={() => setReviewOpen(true)}
                className="w-full h-12 rounded-xl gradient-primary text-white font-semibold">
                <Sparkles className="w-4 h-4 mr-2" /> Leave a Review
              </Button>
            )}
            {hasReviewed && (
              <p className="text-xs text-center text-muted-foreground">✓ Review submitted</p>
            )}
          </motion.div>
        )}

        {/* Owner: Review completion */}
        {isOwner && job.status === "pending_review" && (
          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="space-y-4">
            <div className="bg-card rounded-2xl shadow-card p-5">
              <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <Camera className="w-4 h-4 text-primary" /> {t("job.review_completion")}
              </h3>
              {completionPhotos.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-muted-foreground mb-2">{t("job.completion_photos")}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {completionPhotos.map((url, i) => (
                      <img key={i} src={url} className="w-full aspect-square object-cover rounded-xl border border-border" alt={`Completion ${i + 1}`} />
                    ))}
                  </div>
                </div>
              )}
              {completionNotes && (
                <div className="bg-accent rounded-xl p-3 mb-3">
                  <p className="text-xs font-medium text-foreground mb-1">{t("job.cleaner_notes")}</p>
                  <p className="text-sm text-muted-foreground">{completionNotes}</p>
                </div>
              )}
              <Button onClick={confirmCompletion}
                className="w-full h-12 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 font-semibold">
                <CheckCircle className="w-4 h-4 mr-2" /> {t("job.approve_payment")}
              </Button>
            </div>
          </motion.div>
        )}

        {/* Owner: Completed */}
        {isOwner && job.status === "completed" && (
          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="space-y-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
              <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <h3 className="font-bold text-foreground mb-1">{t("job.completed")}</h3>
              <p className="text-sm text-muted-foreground">{t("job.payment_released")}</p>
            </div>
            {!hasReviewed && job.hired_cleaner_id && (
              <Button onClick={() => setReviewOpen(true)}
                className="w-full h-12 rounded-xl gradient-primary text-white font-semibold">
                <Sparkles className="w-4 h-4 mr-2" /> Leave a Review
              </Button>
            )}
            {hasReviewed && (
              <p className="text-xs text-center text-muted-foreground">✓ Review submitted</p>
            )}
          </motion.div>
        )}
      </div>

      {job && id && (isOwner || isCleaner) && (
        <ReviewModal
          open={reviewOpen}
          onClose={() => { setReviewOpen(false); setHasReviewed(true); }}
          jobId={id}
          reviewedId={isOwner ? job.hired_cleaner_id : job.owner_id}
        />
      )}

      <BottomNav />
    </div>
  );
}

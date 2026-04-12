import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, MapPin, Bed, Bath, Camera, CheckCircle, AlertTriangle,
  Image as ImageIcon, Play, FileText, Lock, Sparkles, Clock, Home, ImagePlus
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import BottomNav from "@/components/BottomNav";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

export default function JobDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [completionPhotos, setCompletionPhotos] = useState<string[]>([]);
  const [completionNotes, setCompletionNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [startingJob, setStartingJob] = useState(false);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);

  const [ownerInstructions, setOwnerInstructions] = useState("");
  const [doorAccess, setDoorAccess] = useState("");
  const [savingInstructions, setSavingInstructions] = useState(false);

  useEffect(() => { if (id) fetchJob(); }, [id]);

  const fetchJob = async () => {
    setLoading(true);
    const { data } = await supabase.from("jobs").select("*").eq("id", id!).single();
    if (data) {
      setJob(data);
      setCompletionPhotos((data as any).completion_photos || []);
      setCompletionNotes((data as any).completion_notes || "");
      setOwnerInstructions((data as any).owner_instructions || "");
      setDoorAccess((data as any).door_access_info || "");
    }
    setLoading(false);
  };

  const isOwner = job?.owner_id === user?.id;
  const isCleaner = job?.hired_cleaner_id === user?.id;

  const saveInstructions = async () => {
    if (!id) return;
    setSavingInstructions(true);
    await supabase.from("jobs").update({ owner_instructions: ownerInstructions, door_access_info: doorAccess }).eq("id", id);
    toast.success(t("job.instructions_saved"));
    setSavingInstructions(false);
  };

  const startJob = async () => {
    if (!id) return;
    setStartingJob(true);
    await supabase.from("jobs").update({ status: "in_progress" }).eq("id", id);
    toast.success(t("job.started_success"));
    await fetchJob();
    setStartingJob(false);
  };

  const uploadCompletionPhoto = async (file: File) => {
    if (!user || !id) return;
    setUploading(true);
    const path = `completion/${id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("portfolio").upload(path, file);
    if (error) { toast.error(t("job.upload_failed")); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("portfolio").getPublicUrl(path);
    const updated = [...completionPhotos, publicUrl];
    await supabase.from("jobs").update({ completion_photos: updated }).eq("id", id);
    setCompletionPhotos(updated);
    setUploading(false);
    toast.success(t("job.photo_uploaded"));
  };

  const submitCompletion = async () => {
    if (!id || completionPhotos.length === 0) {
      toast.error(t("job.upload_one_photo"));
      return;
    }
    setCompleting(true);
    await supabase.from("jobs").update({ status: "pending_review", completion_photos: completionPhotos, completion_notes: completionNotes }).eq("id", id);
    toast.success(t("job.submitted_review"));
    await fetchJob();
    setCompleting(false);
  };

  const confirmCompletion = async () => {
    if (!id || !job) return;
    await supabase.from("jobs").update({ status: "completed", owner_confirmed_completion: true }).eq("id", id);
    const { data: cleanerProfile } = await supabase.from("profiles").select("jobs_completed, total_earnings").eq("id", job.hired_cleaner_id).single();
    if (cleanerProfile) {
      await supabase.from("profiles").update({
        jobs_completed: (cleanerProfile.jobs_completed || 0) + 1,
        total_earnings: (cleanerProfile.total_earnings || 0) + (job.cleaner_earnings || 0),
      }).eq("id", job.hired_cleaner_id);
    }
    const count = (cleanerProfile?.jobs_completed || 0) + 1;
    const badges = [];
    if (count >= 10) badges.push("Rising Cleaner");
    if (count >= 25) badges.push("Top Cleaner");
    if (count >= 50) badges.push("Elite Cleaner");
    for (const badge of badges) {
      const { data: existing } = await supabase.from("rewards").select("id").eq("user_id", job.hired_cleaner_id).eq("badge_name", badge).maybeSingle();
      if (!existing) await supabase.from("rewards").insert({ user_id: job.hired_cleaner_id, badge_name: badge });
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
        {/* Job Summary */}
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-card rounded-2xl shadow-card p-5">
          <div className="flex items-start justify-between mb-2">
            <h1 className="text-xl font-bold text-foreground flex-1">{job.title}</h1>
            <span className="text-2xl font-bold text-primary">${job.price}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-3">
            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {job.city || "N/A"}</span>
            <span className="flex items-center gap-1"><Bed className="w-3.5 h-3.5" /> {job.bedrooms} {t("common.bed")}</span>
            <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5" /> {job.bathrooms} {t("common.bath")}</span>
            <Badge variant="outline" className="text-[10px]">{job.cleaning_type}</Badge>
          </div>
          {job.address && <p className="text-sm text-muted-foreground mb-2"><MapPin className="w-3.5 h-3.5 inline mr-1 text-primary" />{job.address}</p>}
          {job.description && <p className="text-sm text-foreground/80 leading-relaxed">{job.description}</p>}
        </motion.div>

        {/* Owner: Editable Instructions */}
        {isOwner && (
          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 }}
            className="bg-card rounded-2xl shadow-card p-5">
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> {t("job.instructions_access")}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">{t("job.instructions_for_cleaner")}</label>
                <Textarea placeholder={t("job.instructions_placeholder")} value={ownerInstructions}
                  onChange={(e) => setOwnerInstructions(e.target.value)} className="rounded-xl min-h-[80px]" />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">{t("job.door_access")}</label>
                <Textarea placeholder={t("job.door_access_placeholder")} value={doorAccess}
                  onChange={(e) => setDoorAccess(e.target.value)} className="rounded-xl min-h-[60px]" />
              </div>
              <Button onClick={saveInstructions} disabled={savingInstructions} size="sm"
                className="rounded-xl gradient-primary text-white text-xs font-semibold">
                {savingInstructions ? t("job.saving") : t("job.save_instructions")}
              </Button>
            </div>
          </motion.div>
        )}

        {/* Cleaner: Read-Only */}
        {isCleaner && (
          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 }} className="space-y-4">
            <div className="bg-card rounded-2xl shadow-card p-5">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-primary" /> {t("job.instructions")}
              </h3>
              {ownerInstructions ? (
                <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{ownerInstructions}</p>
                </div>
              ) : (
                <div className="bg-accent/50 rounded-xl p-4 flex items-center gap-3">
                  <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">{t("job.no_instructions")}</p>
                </div>
              )}
            </div>

            <div className="bg-card rounded-2xl shadow-card p-5 border-l-4 border-l-amber-400">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
                <Lock className="w-4 h-4 text-amber-500" /> {t("job.access_details")}
              </h3>
              {doorAccess ? (
                <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{doorAccess}</p>
                </div>
              ) : (
                <div className="bg-accent/50 rounded-xl p-4 flex items-center gap-3">
                  <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">{t("job.no_access")}</p>
                </div>
              )}
            </div>

            {propertyPhotos.length > 0 && (
              <div className="bg-card rounded-2xl shadow-card p-5">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
                  <Home className="w-4 h-4 text-primary" /> {t("job.reference_photos")}
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {propertyPhotos.map((url, i) => (
                    <img key={i} src={url} className="w-full aspect-square object-cover rounded-xl border border-border" alt={`Reference ${i + 1}`} />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Cleaner: Start Job */}
        {isCleaner && ["accepted", "hired"].includes(job.status) && (
          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
            <Button onClick={startJob} disabled={startingJob}
              className="w-full h-16 rounded-2xl gradient-primary text-white font-bold text-lg shadow-[0_4px_14px_0_hsla(271,91%,65%,0.4)] hover:shadow-[0_6px_20px_0_hsla(271,91%,65%,0.5)] hover:opacity-95 transition-all active:scale-[0.98]">
              <Play className="w-6 h-6 mr-2" />
              {startingJob ? t("job.starting") : t("job.start")}
            </Button>
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
                  <input type="file" accept="image/*" className="hidden" disabled={uploading}
                    onChange={(e) => e.target.files?.[0] && uploadCompletionPhoto(e.target.files[0])} />
                </label>
              </div>

              {completionPhotos.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {completionPhotos.map((url, i) => (
                    <motion.img key={i} src={url} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      className="w-full aspect-square object-cover rounded-xl border border-border" alt={`Work photo ${i + 1}`} />
                  ))}
                </div>
              ) : (
                <div className="border-2 border-dashed border-primary/20 rounded-xl p-8 text-center bg-primary/5">
                  <ImageIcon className="w-10 h-10 text-primary/40 mx-auto mb-2" />
                  <p className="text-sm text-foreground font-medium">{t("job.upload_work_photos")}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t("job.upload_required")}</p>
                </div>
              )}

              {uploading && (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-muted-foreground">{t("job.uploading")}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">{t("job.completion_notes")}</label>
                <Textarea placeholder={t("job.completion_notes_placeholder")} value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)} className="rounded-xl min-h-[60px]" />
              </div>
            </div>

            <Button onClick={submitCompletion} disabled={completing || completionPhotos.length === 0}
              className="w-full h-16 rounded-2xl bg-emerald-500 text-white hover:bg-emerald-600 font-bold text-lg shadow-[0_4px_14px_0_rgba(16,185,129,0.3)] transition-all active:scale-[0.98]">
              <CheckCircle className="w-6 h-6 mr-2" />
              {completing ? t("job.submitting") : t("job.mark_finished")}
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
          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-7 h-7 text-emerald-500" />
            </div>
            <h3 className="font-bold text-foreground mb-1">{t("job.completed")}</h3>
            <p className="text-sm text-muted-foreground">{t("job.payment_released")}</p>
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
          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
            <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <h3 className="font-bold text-foreground mb-1">{t("job.completed")}</h3>
            <p className="text-sm text-muted-foreground">{t("job.payment_released")}</p>
          </motion.div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

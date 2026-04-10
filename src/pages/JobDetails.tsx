import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, MapPin, Bed, Bath, Camera, CheckCircle, AlertTriangle,
  Image as ImageIcon, Play, FileText, Lock, Shield, Sparkles, Clock
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import BottomNav from "@/components/BottomNav";
import { toast } from "sonner";

export default function JobDetails() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [completionPhotos, setCompletionPhotos] = useState<string[]>([]);
  const [completionNotes, setCompletionNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [startingJob, setStartingJob] = useState(false);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);

  // Owner form fields
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

  // Owner: save instructions
  const saveInstructions = async () => {
    if (!id) return;
    setSavingInstructions(true);
    await supabase.from("jobs").update({
      owner_instructions: ownerInstructions,
      door_access_info: doorAccess,
    }).eq("id", id);
    toast.success("Instructions saved!");
    setSavingInstructions(false);
  };

  // Cleaner: start job
  const startJob = async () => {
    if (!id) return;
    setStartingJob(true);
    await supabase.from("jobs").update({ status: "in_progress" }).eq("id", id);
    toast.success("Job started! Good luck 💪");
    await fetchJob();
    setStartingJob(false);
  };

  // Cleaner: upload completion photo
  const uploadCompletionPhoto = async (file: File) => {
    if (!user || !id) return;
    setUploading(true);
    const path = `completion/${id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("portfolio").upload(path, file);
    if (error) { toast.error("Upload failed"); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("portfolio").getPublicUrl(path);
    const updated = [...completionPhotos, publicUrl];
    await supabase.from("jobs").update({ completion_photos: updated }).eq("id", id);
    setCompletionPhotos(updated);
    setUploading(false);
    toast.success("Photo uploaded!");
  };

  // Cleaner: submit completion
  const submitCompletion = async () => {
    if (!id || completionPhotos.length === 0) {
      toast.error("Please upload at least one completion photo.");
      return;
    }
    setCompleting(true);
    await supabase.from("jobs").update({
      status: "pending_review",
      completion_photos: completionPhotos,
      completion_notes: completionNotes,
    }).eq("id", id);
    toast.success("Submitted for owner review! 🎉");
    await fetchJob();
    setCompleting(false);
  };

  // Owner: confirm completion & release payment
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
    // Award badges
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
    toast.success("Completion confirmed! Payment released.");
    await fetchJob();
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

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!job) return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Job not found</p></div>;

  const status = statusConfig[job.status] || { color: "bg-muted text-muted-foreground", label: job.status.toUpperCase() };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-foreground"><ArrowLeft className="w-5 h-5" /></button>
        <h2 className="font-semibold text-foreground flex-1">Job Details</h2>
        <Badge className={`${status.color} border-0 text-[10px]`}>{status.label}</Badge>
      </div>

      {/* Payment Success Animation */}
      <AnimatePresence>
        {showPaymentSuccess && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-20">
            <div className="bg-emerald-500 text-white px-6 py-4 rounded-2xl shadow-elevated flex items-center gap-3">
              <Sparkles className="w-5 h-5" />
              <span className="font-semibold">Payment Released 🎉</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-4 py-4 space-y-4">
        {/* Job Summary Card */}
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-card rounded-2xl shadow-card p-4">
          <h1 className="text-xl font-bold text-foreground mb-1">{job.title}</h1>
          <p className="text-2xl font-bold text-primary mb-3">${job.price}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {job.city || "N/A"}</span>
            <span className="flex items-center gap-1"><Bed className="w-3 h-3" /> {job.bedrooms} bed</span>
            <span className="flex items-center gap-1"><Bath className="w-3 h-3" /> {job.bathrooms} bath</span>
          </div>
          {job.address && <p className="text-sm text-muted-foreground"><MapPin className="w-3 h-3 inline mr-1" />{job.address}</p>}
          {job.description && <p className="text-sm text-muted-foreground mt-2">{job.description}</p>}
          <Badge variant="outline" className="text-[10px] mt-2">{job.cleaning_type}</Badge>
        </motion.div>

        {/* ===== OWNER VIEW: Editable Instructions ===== */}
        {isOwner && (
          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 }}
            className="bg-card rounded-2xl shadow-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> Instructions & Access Info
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Instructions for the cleaner</label>
                <Textarea placeholder="Special cleaning instructions, areas to focus on..." value={ownerInstructions}
                  onChange={(e) => setOwnerInstructions(e.target.value)} className="rounded-xl min-h-[80px]" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Door / Entry Access</label>
                <Textarea placeholder="Door code, lockbox location, gate code..." value={doorAccess}
                  onChange={(e) => setDoorAccess(e.target.value)} className="rounded-xl min-h-[60px]" />
              </div>
              <Button onClick={saveInstructions} disabled={savingInstructions} size="sm"
                className="rounded-xl gradient-primary text-primary-foreground text-xs">
                {savingInstructions ? "Saving..." : "Save Instructions"}
              </Button>
            </div>
          </motion.div>
        )}

        {/* ===== CLEANER VIEW: Read-Only Instructions ===== */}
        {isCleaner && (ownerInstructions || doorAccess) && (
          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 }}
            className="bg-card rounded-2xl shadow-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" /> Job Instructions
            </h3>
            {ownerInstructions && (
              <div className="mb-3">
                <p className="text-xs font-medium text-foreground mb-1">📋 Instructions</p>
                <div className="bg-accent rounded-xl p-3">
                  <p className="text-sm text-foreground">{ownerInstructions}</p>
                </div>
              </div>
            )}
            {doorAccess && (
              <div>
                <p className="text-xs font-medium text-foreground mb-1">🔑 Door / Entry Access</p>
                <div className="bg-accent rounded-xl p-3">
                  <p className="text-sm text-foreground">{doorAccess}</p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {isCleaner && !ownerInstructions && !doorAccess && ["hired", "in_progress"].includes(job.status) && (
          <div className="bg-accent rounded-xl p-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <p className="text-xs text-muted-foreground">The owner hasn't added instructions yet. Check back before starting.</p>
          </div>
        )}

        {/* ===== CLEANER: Start Job Button (hired → in_progress) ===== */}
        {isCleaner && job.status === "hired" && (
          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
            <Button onClick={startJob} disabled={startingJob}
              className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm hover:opacity-90">
              <Play className="w-5 h-5 mr-2" />
              {startingJob ? "Starting..." : "Start Job"}
            </Button>
          </motion.div>
        )}

        {/* ===== CLEANER: Job Execution (in_progress) ===== */}
        {isCleaner && job.status === "in_progress" && (
          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
            className="bg-card rounded-2xl shadow-card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Camera className="w-4 h-4 text-primary" /> Upload Completion Photos
              </h3>
              <label className="text-xs text-primary cursor-pointer font-medium flex items-center gap-1">
                + Add Photo
                <input type="file" accept="image/*" className="hidden" disabled={uploading}
                  onChange={(e) => e.target.files?.[0] && uploadCompletionPhoto(e.target.files[0])} />
              </label>
            </div>

            {completionPhotos.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {completionPhotos.map((url, i) => (
                  <motion.img key={i} src={url} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className="w-full aspect-square object-cover rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
                <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Upload photos of your completed work</p>
              </div>
            )}

            {uploading && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-muted-foreground">Uploading...</span>
              </div>
            )}

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Completion Notes (optional)</label>
              <Textarea placeholder="Anything unusual? Missing supplies? Damage noticed? Extra details..." value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)} className="rounded-xl min-h-[60px]" />
            </div>

            <Button onClick={submitCompletion} disabled={completing || completionPhotos.length === 0}
              className="w-full h-12 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 font-semibold text-sm">
              <CheckCircle className="w-5 h-5 mr-2" />
              {completing ? "Submitting..." : "Submit Job Completion"}
            </Button>
          </motion.div>
        )}

        {/* ===== CLEANER: Pending Review state ===== */}
        {isCleaner && job.status === "pending_review" && (
          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 text-center">
            <Clock className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-indigo-700 mb-1">Waiting for Owner Review</p>
            <p className="text-xs text-indigo-600">The owner will review your work and release payment once approved.</p>
            {completionPhotos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {completionPhotos.map((url, i) => <img key={i} src={url} className="w-full aspect-square object-cover rounded-xl" />)}
              </div>
            )}
          </motion.div>
        )}

        {/* ===== OWNER: Review Completion ===== */}
        {isOwner && job.status === "pending_review" && (
          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="bg-card rounded-2xl shadow-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Review Completion</h3>

            {completionPhotos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {completionPhotos.map((url, i) => <img key={i} src={url} className="w-full aspect-square object-cover rounded-xl" />)}
              </div>
            )}

            {job.completion_notes && (
              <div className="bg-accent rounded-xl p-3 mb-3">
                <p className="text-xs font-medium text-foreground mb-1">Cleaner Notes:</p>
                <p className="text-sm text-muted-foreground">{job.completion_notes}</p>
              </div>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">Confirming completion will release payment to the cleaner.</p>
            </div>

            <div className="bg-accent rounded-xl p-3 mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Total Amount</span>
                <span className="font-medium">${job.total_amount || job.price}</span>
              </div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Platform Fee</span>
                <span className="text-destructive">-${job.platform_fee || (job.price * 0.1).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Cleaner Receives</span>
                <span className="text-primary font-semibold">${job.cleaner_earnings || (job.price * 0.9).toFixed(2)}</span>
              </div>
            </div>

            <Button onClick={confirmCompletion}
              className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm hover:opacity-90">
              <CheckCircle className="w-5 h-5 mr-2" /> Approve & Release Payment
            </Button>
          </motion.div>
        )}

        {/* ===== Completed state ===== */}
        {job.status === "completed" && job.owner_confirmed_completion && (
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-700">Job Completed ✅</p>
              <p className="text-xs text-emerald-600">Payment has been released to the cleaner.</p>
            </div>
          </motion.div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

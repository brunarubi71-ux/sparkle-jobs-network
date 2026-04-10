import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Bed, Bath, Clock, Camera, CheckCircle, AlertTriangle, Play, Send, FileText, Key, StickyNote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import BottomNav from "@/components/BottomNav";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function JobDetails() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Owner editable fields
  const [ownerInstructions, setOwnerInstructions] = useState("");
  const [doorAccess, setDoorAccess] = useState("");
  const [savingInstructions, setSavingInstructions] = useState(false);

  // Cleaner completion fields
  const [completionPhotos, setCompletionPhotos] = useState<string[]>([]);
  const [completionNotes, setCompletionNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [startingJob, setStartingJob] = useState(false);

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
    } as any).eq("id", id);
    toast.success("Instructions saved!");
    setSavingInstructions(false);
  };

  // Cleaner: start job
  const startJob = async () => {
    if (!id) return;
    setStartingJob(true);
    await supabase.from("jobs").update({ status: "in_progress" } as any).eq("id", id);
    toast.success("Job started! Good luck! 🧹");
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
    await supabase.from("jobs").update({ completion_photos: updated } as any).eq("id", id);
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
    setSubmitting(true);
    await supabase.from("jobs").update({
      status: "pending_review",
      completion_photos: completionPhotos,
      completion_notes: completionNotes,
    } as any).eq("id", id);
    toast.success("Job submitted for review! ✅");
    await fetchJob();
    setSubmitting(false);
  };

  // Owner: approve completion
  const approveCompletion = async () => {
    if (!id || !job) return;
    await supabase.from("jobs").update({
      status: "completed",
      owner_confirmed_completion: true,
    } as any).eq("id", id);
    // Update cleaner stats
    const { data: cleanerProfile } = await supabase.from("profiles").select("jobs_completed, total_earnings").eq("id", job.hired_cleaner_id).single();
    if (cleanerProfile) {
      await supabase.from("profiles").update({
        jobs_completed: (cleanerProfile.jobs_completed || 0) + 1,
        total_earnings: (cleanerProfile.total_earnings || 0) + (job.cleaner_earnings || 0),
      }).eq("id", job.hired_cleaner_id);
    }
    toast.success("Completion approved! Payment released. 🎉");
    await fetchJob();
  };

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      open: "bg-emerald-100 text-emerald-700",
      hired: "bg-amber-100 text-amber-700",
      in_progress: "bg-purple-100 text-purple-700",
      pending_review: "bg-blue-100 text-blue-700",
      completed: "bg-green-100 text-green-700",
      cancelled: "bg-red-100 text-red-700",
    };
    return map[s] || "bg-muted text-muted-foreground";
  };

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      open: "OPEN",
      hired: "HIRED",
      in_progress: "IN PROGRESS",
      pending_review: "PENDING REVIEW",
      completed: "COMPLETED",
      cancelled: "CANCELLED",
    };
    return map[s] || s.toUpperCase();
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading job details...</div>
    </div>
  );

  if (!job) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Job not found</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="text-foreground"><ArrowLeft className="w-5 h-5" /></button>
        <h2 className="font-semibold text-foreground flex-1">Job Details</h2>
        <Badge className={`${statusColor(job.status)} border-0 text-[10px]`}>{statusLabel(job.status)}</Badge>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="px-4 py-4 space-y-4">
        {/* Job Summary Card */}
        <div className="bg-card rounded-2xl shadow-card p-4">
          <h1 className="text-xl font-bold text-foreground mb-1">{job.title}</h1>
          <p className="text-2xl font-bold text-primary mb-3">${job.price}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {job.city || "N/A"}</span>
            <span className="flex items-center gap-1"><Bed className="w-3 h-3" /> {job.bedrooms} bed</span>
            <span className="flex items-center gap-1"><Bath className="w-3 h-3" /> {job.bathrooms} bath</span>
          </div>
          {job.address && <p className="text-sm text-muted-foreground"><MapPin className="w-3 h-3 inline mr-1" />{job.address}</p>}
          {job.description && <p className="text-sm text-muted-foreground mt-2">{job.description}</p>}
        </div>

        {/* ==================== OWNER VIEW ==================== */}
        {isOwner && (
          <>
            {/* Owner: Edit Instructions */}
            <div className="bg-card rounded-2xl shadow-card p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" /> Instructions & Access Info
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Instructions for the cleaner</label>
                  <Textarea placeholder="e.g. Focus on kitchen and bathrooms, use eco-friendly products..." value={ownerInstructions}
                    onChange={(e) => setOwnerInstructions(e.target.value)} className="rounded-xl min-h-[80px]" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Door access / entry instructions</label>
                  <Textarea placeholder="e.g. Lockbox code 4521, side entrance..." value={doorAccess}
                    onChange={(e) => setDoorAccess(e.target.value)} className="rounded-xl min-h-[60px]" />
                </div>
                <Button onClick={saveInstructions} disabled={savingInstructions} size="sm"
                  className="rounded-xl gradient-primary text-primary-foreground text-xs">
                  {savingInstructions ? "Saving..." : "Save Instructions"}
                </Button>
              </div>
            </div>

            {/* Owner: Review completion (pending_review status) */}
            {job.status === "pending_review" && (
              <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="bg-card rounded-2xl shadow-card p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-primary" /> Review Completion
                </h3>
                {completionPhotos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {completionPhotos.map((url, i) => <img key={i} src={url} className="w-full aspect-square object-cover rounded-xl" alt={`Completion ${i+1}`} />)}
                  </div>
                )}
                {(job as any).completion_notes && (
                  <div className="bg-accent rounded-xl p-3 mb-3">
                    <p className="text-xs font-medium text-foreground mb-1">Cleaner Notes:</p>
                    <p className="text-sm text-muted-foreground">{(job as any).completion_notes}</p>
                  </div>
                )}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-700">Approving will release payment to the cleaner.</p>
                </div>
                <Button onClick={approveCompletion} className="w-full h-11 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm">
                  <CheckCircle className="w-4 h-4 mr-2" /> Approve & Release Payment
                </Button>
              </motion.div>
            )}

            {/* Owner: Completed confirmation */}
            {job.status === "completed" && job.owner_confirmed_completion && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <p className="text-xs text-emerald-700 font-medium">Completion confirmed. Payment released.</p>
              </div>
            )}
          </>
        )}

        {/* ==================== CLEANER VIEW ==================== */}
        {isCleaner && (
          <>
            {/* Cleaner: Read-only Instructions */}
            {(ownerInstructions || doorAccess) && (
              <div className="bg-card rounded-2xl shadow-card p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" /> Job Instructions
                </h3>
                {ownerInstructions && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1"><StickyNote className="w-3 h-3" /> Instructions</p>
                    <div className="bg-accent rounded-xl p-3">
                      <p className="text-sm text-foreground">{ownerInstructions}</p>
                    </div>
                  </div>
                )}
                {doorAccess && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1"><Key className="w-3 h-3" /> Door Access</p>
                    <div className="bg-accent rounded-xl p-3">
                      <p className="text-sm text-foreground">{doorAccess}</p>
                    </div>
                  </div>
                )}
                {!ownerInstructions && !doorAccess && (
                  <p className="text-xs text-muted-foreground italic">No instructions provided yet by the owner.</p>
                )}
              </div>
            )}

            {/* Cleaner: Start Job (when status = hired) */}
            {job.status === "hired" && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Button onClick={startJob} disabled={startingJob}
                  className="w-full h-12 rounded-2xl gradient-primary text-primary-foreground font-bold text-base shadow-lg">
                  <Play className="w-5 h-5 mr-2" />
                  {startingJob ? "Starting..." : "Start Job"}
                </Button>
              </motion.div>
            )}

            {/* Cleaner: Job Execution (in_progress) */}
            {job.status === "in_progress" && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                {/* Upload completion photos */}
                <div className="bg-card rounded-2xl shadow-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Camera className="w-4 h-4 text-primary" /> Upload Completion Photos
                    </h3>
                    <label className="text-xs text-primary cursor-pointer font-medium px-3 py-1.5 bg-primary/10 rounded-full">
                      {uploading ? "Uploading..." : "+ Add Photo"}
                      <input type="file" accept="image/*" className="hidden" disabled={uploading}
                        onChange={(e) => e.target.files?.[0] && uploadCompletionPhoto(e.target.files[0])} />
                    </label>
                  </div>
                  {completionPhotos.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {completionPhotos.map((url, i) => (
                        <motion.img key={i} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                          src={url} className="w-full aspect-square object-cover rounded-xl" alt={`Photo ${i+1}`} />
                      ))}
                    </div>
                  ) : (
                    <div className="bg-accent rounded-xl p-4 text-center">
                      <Camera className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">Upload photos of your completed work before submitting.</p>
                    </div>
                  )}
                </div>

                {/* Completion notes */}
                <div className="bg-card rounded-2xl shadow-card p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    <StickyNote className="w-4 h-4 text-primary" /> Completion Notes (optional)
                  </h3>
                  <Textarea
                    placeholder="Anything unusual? Missing supplies? Damage noticed? Extra details..."
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    className="rounded-xl min-h-[80px]"
                  />
                </div>

                {/* Submit completion */}
                <Button onClick={submitCompletion} disabled={submitting || completionPhotos.length === 0}
                  className="w-full h-12 rounded-2xl bg-emerald-500 text-white hover:bg-emerald-600 font-bold text-base shadow-lg">
                  <Send className="w-5 h-5 mr-2" />
                  {submitting ? "Submitting..." : "Submit Job Completion"}
                </Button>
              </motion.div>
            )}

            {/* Cleaner: Pending review state */}
            {job.status === "pending_review" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                <Clock className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-blue-700">Waiting for Owner Review</p>
                  <p className="text-xs text-blue-600 mt-1">Your work has been submitted. The job owner will review and approve your completion.</p>
                </div>
              </motion.div>
            )}

            {/* Cleaner: Completed */}
            {job.status === "completed" && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
                <div>
                  <p className="text-sm font-semibold text-emerald-700">Job Completed! 🎉</p>
                  <p className="text-xs text-emerald-600 mt-0.5">Payment has been released to your account.</p>
                </div>
              </motion.div>
            )}
          </>
        )}
      </motion.div>

      <BottomNav />
    </div>
  );
}

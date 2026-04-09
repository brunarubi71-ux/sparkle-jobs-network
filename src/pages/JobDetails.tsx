import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Bed, Bath, Clock, Camera, CheckCircle, AlertTriangle, Image as ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import BottomNav from "@/components/BottomNav";
import { toast } from "sonner";

export default function JobDetails() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [completionPhotos, setCompletionPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [completing, setCompleting] = useState(false);
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
    await supabase.from("jobs").update({
      owner_instructions: ownerInstructions,
      door_access_info: doorAccess,
    }).eq("id", id);
    toast.success("Instructions saved!");
    setSavingInstructions(false);
  };

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

  const markCompleted = async () => {
    if (!id || completionPhotos.length === 0) {
      toast.error("Please upload at least one completion photo first.");
      return;
    }
    setCompleting(true);
    await supabase.from("jobs").update({ status: "completed" }).eq("id", id);
    toast.success("Job marked as completed! Waiting for owner confirmation.");
    fetchJob();
    setCompleting(false);
  };

  const confirmCompletion = async () => {
    if (!id || !job) return;
    await supabase.from("jobs").update({ owner_confirmed_completion: true }).eq("id", id);
    // Release payment - update cleaner stats
    const { data: cleanerProfile } = await supabase.from("profiles").select("jobs_completed, total_earnings").eq("id", job.hired_cleaner_id).single();
    if (cleanerProfile) {
      await supabase.from("profiles").update({
        jobs_completed: (cleanerProfile.jobs_completed || 0) + 1,
        total_earnings: (cleanerProfile.total_earnings || 0) + (job.cleaner_earnings || 0),
      }).eq("id", job.hired_cleaner_id);
    }
    toast.success("Completion confirmed! Payment released to cleaner.");
    fetchJob();
  };

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      open: "bg-emerald-100 text-emerald-700",
      hired: "bg-amber-100 text-amber-700",
      in_progress: "bg-purple-100 text-purple-700",
      completed: "bg-green-100 text-green-700",
      cancelled: "bg-red-100 text-red-700",
    };
    return map[s] || "bg-muted text-muted-foreground";
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  if (!job) return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Job not found</p></div>;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-foreground"><ArrowLeft className="w-5 h-5" /></button>
        <h2 className="font-semibold text-foreground flex-1">Job Details</h2>
        <Badge className={`${statusColor(job.status)} border-0 text-[10px]`}>{job.status.toUpperCase()}</Badge>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Job Info */}
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

        {/* Owner Instructions Section (Owner editable, cleaner viewable) */}
        {(isOwner || isCleaner) && (
          <div className="bg-card rounded-2xl shadow-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Instructions & Access Info</h3>
            {isOwner ? (
              <div className="space-y-3">
                <Textarea placeholder="Instructions for the cleaner..." value={ownerInstructions}
                  onChange={(e) => setOwnerInstructions(e.target.value)} className="rounded-xl min-h-[80px]" />
                <Textarea placeholder="Door access code / entry instructions..." value={doorAccess}
                  onChange={(e) => setDoorAccess(e.target.value)} className="rounded-xl min-h-[60px]" />
                <Button onClick={saveInstructions} disabled={savingInstructions} size="sm"
                  className="rounded-xl gradient-primary text-primary-foreground text-xs">
                  {savingInstructions ? "Saving..." : "Save Instructions"}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {ownerInstructions ? (
                  <div><p className="text-xs font-medium text-foreground mb-1">Instructions:</p><p className="text-sm text-muted-foreground">{ownerInstructions}</p></div>
                ) : <p className="text-xs text-muted-foreground italic">No instructions provided yet.</p>}
                {doorAccess && (
                  <div><p className="text-xs font-medium text-foreground mb-1">Door Access:</p><p className="text-sm text-muted-foreground">{doorAccess}</p></div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Completion Photos (Cleaner uploads) */}
        {isCleaner && ["in_progress", "completed"].includes(job.status) && (
          <div className="bg-card rounded-2xl shadow-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1"><Camera className="w-4 h-4" /> Completion Photos</h3>
              {job.status === "in_progress" && (
                <label className="text-xs text-primary cursor-pointer font-medium">
                  + Upload Photo
                  <input type="file" accept="image/*" className="hidden" disabled={uploading}
                    onChange={(e) => e.target.files?.[0] && uploadCompletionPhoto(e.target.files[0])} />
                </label>
              )}
            </div>
            {completionPhotos.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {completionPhotos.map((url, i) => <img key={i} src={url} className="w-full aspect-square object-cover rounded-xl" />)}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mb-3">Upload photos of your completed work before marking as done.</p>
            )}
            {job.status === "in_progress" && (
              <Button onClick={markCompleted} disabled={completing || completionPhotos.length === 0}
                className="w-full h-10 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 font-semibold text-sm">
                <CheckCircle className="w-4 h-4 mr-2" />
                {completing ? "Submitting..." : "Mark as Completed"}
              </Button>
            )}
          </div>
        )}

        {/* Owner views completion photos and confirms */}
        {isOwner && job.status === "completed" && !job.owner_confirmed_completion && (
          <div className="bg-card rounded-2xl shadow-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Review Completion</h3>
            {completionPhotos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {completionPhotos.map((url, i) => <img key={i} src={url} className="w-full aspect-square object-cover rounded-xl" />)}
              </div>
            )}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">Confirming completion will release payment to the cleaner.</p>
            </div>
            <Button onClick={confirmCompletion} className="w-full h-10 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm">
              <CheckCircle className="w-4 h-4 mr-2" /> Confirm & Release Payment
            </Button>
          </div>
        )}

        {job.owner_confirmed_completion && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <p className="text-xs text-emerald-700 font-medium">Completion confirmed. Payment released.</p>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

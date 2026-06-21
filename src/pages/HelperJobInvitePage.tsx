import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { sendNotification } from "@/lib/notifications";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Sparkles, Bed, Bath, MapPin, Clock, DollarSign,
  CheckCircle, Lock, Key, Play, Home, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

export default function HelperJobInvitePage() {
  const { jobId } = useParams<{ jobId: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [job, setJob] = useState<any>(null);
  const [privateDetails, setPrivateDetails] = useState<any>(null);
  const [myApplication, setMyApplication] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (jobId) fetchData();
  }, [jobId, user]);

  const fetchData = async () => {
    setLoading(true);
    const { data: jobData } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId!)
      .single();

    setJob(jobData);

    if (user && jobData) {
      // Check if already applied
      const { data: app } = await supabase
        .from("job_applications")
        .select("*")
        .eq("job_id", jobId!)
        .eq("cleaner_id", user.id)
        .maybeSingle();
      setMyApplication(app);

      // If accepted, fetch private details
      if (app?.status === "accepted") {
        const { data: priv } = await supabase
          .from("job_private_details" as any)
          .select("*")
          .eq("job_id", jobId!)
          .maybeSingle();
        setPrivateDetails(priv);
      }
    }
    setLoading(false);
  };

  const acceptJob = async () => {
    if (!user) {
      // Save job id and redirect to auth
      try { localStorage.setItem("shinely_helper_invite", jobId!); } catch {}
      navigate("/auth?mode=signup");
      return;
    }
    if (!job) return;
    setAccepting(true);
    try {
      // Create application as accepted (pre-invited by cleaner)
      const { error } = await supabase
        .from("job_applications")
        .insert({
          job_id: jobId!,
          cleaner_id: user.id,
          status: "accepted",
        } as any);

      if (error) {
        if (error.code === "23505") {
          toast.error("Você já se candidatou a este trabalho.");
        } else {
          throw error;
        }
        setAccepting(false);
        return;
      }

      // Notify the lead cleaner
      if (job.hired_cleaner_id) {
        await sendNotification({
          userId: job.hired_cleaner_id,
          title: "Você ganhou uma Helper! 🎉",
          message: `${profile?.full_name || "Uma helper"} aceitou participar do trabalho "${job.title}".`,
          type: "new_application",
          relatedId: job.id,
          link: `/job/${job.id}`,
        });
      }

      toast.success("Trabalho aceito! Redirecionando...");
      navigate(`/job/${job.id}`);
    } catch (err) {
      toast.error("Erro ao aceitar o trabalho. Tente novamente.");
    } finally {
      setAccepting(false);
    }
  };

  const startJob = async () => {
    if (!jobId) return;
    try {
      const { data: rpcData, error: rpcErr } = await (supabase.rpc as any)("start_team_job", { p_job_id: jobId });
      if (rpcErr) throw rpcErr;
      toast.success("Trabalho iniciado!");
      await fetchData();
    } catch {
      toast.error("Erro ao iniciar. Tente novamente.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center">
        <AlertCircle className="w-12 h-12 text-muted-foreground mb-3" />
        <h2 className="text-lg font-bold text-foreground mb-1">Trabalho não encontrado</h2>
        <p className="text-sm text-muted-foreground">Este link pode estar expirado ou inválido.</p>
      </div>
    );
  }

  const isAccepted = myApplication?.status === "accepted";
  const helperPay = job.helper_pay ?? 0;
  const cleaningTypeLabel: Record<string, string> = {
    residential: "Residencial",
    airbnb: "Airbnb",
    commercial: "Comercial",
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="gradient-primary px-6 pt-14 pb-8 text-center">
        <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <Sparkles className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-xl font-bold text-white mb-1">Convite de Trabalho</h1>
        <p className="text-white/70 text-sm">Uma cleaner te convidou para este trabalho</p>
      </div>

      <div className="flex-1 px-5 py-5 space-y-4">

        {/* Pay highlight */}
        <motion.div
          initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="bg-card rounded-2xl shadow-card p-5 text-center"
        >
          <p className="text-sm text-muted-foreground mb-1">Você vai receber</p>
          <p className="text-4xl font-bold text-primary">${Number(helperPay).toFixed(2)}</p>
          <p className="text-xs text-muted-foreground mt-1">por este trabalho</p>
        </motion.div>

        {/* Basic job info */}
        <motion.div
          initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 }}
          className="bg-card rounded-2xl shadow-card p-4 space-y-3"
        >
          <h2 className="font-bold text-foreground text-base">{job.title}</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Home className="w-4 h-4 text-primary shrink-0" />
              <span>{cleaningTypeLabel[job.cleaning_type] ?? job.cleaning_type}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4 text-primary shrink-0" />
              <span>{job.city || "—"}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Bed className="w-4 h-4 text-primary shrink-0" />
              <span>{job.bedrooms} quarto{job.bedrooms !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Bath className="w-4 h-4 text-primary shrink-0" />
              <span>{job.bathrooms} banheiro{job.bathrooms !== 1 ? "s" : ""}</span>
            </div>
            {job.date_time && (
              <div className="flex items-center gap-2 text-muted-foreground col-span-2">
                <Clock className="w-4 h-4 text-primary shrink-0" />
                <span>{new Date(job.date_time).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
              </div>
            )}
          </div>
          {job.description && !job.description.startsWith("[Recorrência:") && (
            <p className="text-sm text-muted-foreground border-t border-border pt-3">{job.description}</p>
          )}
        </motion.div>

        {/* Private details — only after accepting */}
        {isAccepted && (
          <motion.div
            initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
            className="bg-card rounded-2xl shadow-card p-4 space-y-3"
          >
            <div className="flex items-center gap-2 mb-1">
              <Unlock className="w-4 h-4 text-emerald-500" />
              <h3 className="font-bold text-foreground text-sm">Detalhes do local</h3>
            </div>
            {privateDetails?.address && (
              <div className="flex gap-2 text-sm">
                <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span className="text-foreground">{privateDetails.address}</span>
              </div>
            )}
            {privateDetails?.door_code && (
              <div className="flex gap-2 text-sm">
                <Key className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span className="text-foreground">Código da porta: <strong>{privateDetails.door_code}</strong></span>
              </div>
            )}
            {privateDetails?.lockbox_code && (
              <div className="flex gap-2 text-sm">
                <Lock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span className="text-foreground">Lockbox: <strong>{privateDetails.lockbox_code}</strong></span>
              </div>
            )}
            {privateDetails?.gate_code && (
              <div className="flex gap-2 text-sm">
                <Key className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span className="text-foreground">Portão: <strong>{privateDetails.gate_code}</strong></span>
              </div>
            )}
            {privateDetails?.parking_instructions && (
              <div className="flex gap-2 text-sm">
                <span className="text-muted-foreground">🚗 {privateDetails.parking_instructions}</span>
              </div>
            )}
            {privateDetails?.alarm_instructions && (
              <div className="flex gap-2 text-sm">
                <span className="text-muted-foreground">🔔 {privateDetails.alarm_instructions}</span>
              </div>
            )}
            {privateDetails?.owner_instructions && (
              <div className="flex gap-2 text-sm border-t border-border pt-3">
                <span className="text-muted-foreground">📋 {privateDetails.owner_instructions}</span>
              </div>
            )}
          </motion.div>
        )}

        {/* Lock notice — before accepting */}
        {!isAccepted && (
          <div className="flex items-center gap-3 bg-muted/40 rounded-xl p-3">
            <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">
              Endereço, senhas e detalhes de acesso aparecem após você aceitar o trabalho.
            </p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="px-5 pb-10 pt-2 space-y-3">
        {!isAccepted ? (
          <>
            <Button
              onClick={acceptJob}
              disabled={accepting}
              className="w-full h-14 rounded-2xl gradient-primary text-white font-bold text-base shadow-[0_4px_14px_0_hsla(271,91%,65%,0.4)]"
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              {accepting ? "Aceitando..." : "Aceitar este trabalho"}
            </Button>
            {!user && (
              <p className="text-center text-xs text-muted-foreground">
                Você precisará criar uma conta ou entrar para aceitar.
              </p>
            )}
          </>
        ) : (
          <>
            {/* Accepted — show status + start button if job is open/in_progress */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
              <p className="text-sm font-semibold text-emerald-700">Você aceitou este trabalho!</p>
            </div>

            {(job.status === "open" || job.status === "in_progress") && (
              <Button
                onClick={startJob}
                className="w-full h-14 rounded-2xl gradient-primary text-white font-bold text-base"
              >
                <Play className="w-5 h-5 mr-2" />
                Iniciar trabalho
              </Button>
            )}

            <Button
              onClick={() => navigate(`/job/${job.id}`)}
              variant="outline"
              className="w-full h-12 rounded-2xl font-semibold"
            >
              Abrir painel do trabalho
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

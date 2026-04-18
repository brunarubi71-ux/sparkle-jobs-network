import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import {
  ArrowLeft, Star, Crown, ShieldCheck, MessageCircle,
  Home, Users, DollarSign, CalendarDays, Briefcase,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import PointsBadgesSection from "@/components/PointsBadgesSection";
import { toast } from "sonner";

function formatMemberSince(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export default function PublicProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [avgRatingReceived, setAvgRatingReceived] = useState(0);
  const [avgRatingGiven, setAvgRatingGiven] = useState(0);
  const [cleanersHired, setCleanersHired] = useState(0);

  useEffect(() => {
    if (!id) return;
    fetchAll();
  }, [id]);

  const fetchAll = async () => {
    const { data: p } = await supabase.from("profiles").select("*").eq("id", id!).single();
    setProfile(p);

    if (!p) return;

    if (p.role === "owner") {
      const { data: given } = await supabase
        .from("reviews")
        .select("rating")
        .eq("reviewer_id", id!);
      const list = given || [];
      setAvgRatingGiven(
        list.length
          ? Math.round((list.reduce((s, r: any) => s + r.rating, 0) / list.length) * 10) / 10
          : 0
      );
      const { data: hiredJobs } = await supabase
        .from("jobs")
        .select("hired_cleaner_id")
        .eq("owner_id", id!)
        .not("hired_cleaner_id", "is", null);
      setCleanersHired(new Set((hiredJobs || []).map((j: any) => j.hired_cleaner_id)).size);
    } else {
      const { data: received } = await supabase
        .from("reviews")
        .select("*")
        .eq("reviewed_id", id!)
        .order("created_at", { ascending: false });
      const list = received || [];
      setReviews(list);
      setAvgRatingReceived(
        list.length
          ? Math.round((list.reduce((s, r: any) => s + r.rating, 0) / list.length) * 10) / 10
          : 0
      );
    }
  };

  const startConversation = async () => {
    if (!user || !profile || !id) return;
    if (user.id === id) return;

    // Determine roles for the conversation row
    const meIsOwner = (await supabase.from("profiles").select("role").eq("id", user.id).single())
      .data?.role === "owner";
    const ownerId = meIsOwner ? user.id : id;
    const cleanerId = meIsOwner ? id : user.id;

    // Find existing conversation
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("owner_id", ownerId)
      .eq("cleaner_id", cleanerId)
      .is("job_id", null)
      .maybeSingle();

    let convId = existing?.id;
    if (!convId) {
      const { data: created, error } = await supabase
        .from("conversations")
        .insert({ owner_id: ownerId, cleaner_id: cleanerId })
        .select("id")
        .single();
      if (error || !created) {
        toast.error("Failed to start chat");
        return;
      }
      convId = created.id;
    }
    navigate(`/chat/${convId}`);
  };

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="shimmer w-20 h-20 rounded-full" />
      </div>
    );
  }

  const isOwner = profile.role === "owner";
  const isWorker = profile.role === "cleaner";
  const workerType = profile.worker_type || "cleaner";
  const identityApproved = (profile.identity_status || "unverified") === "approved";
  const memberSince = formatMemberSince(profile.created_at);
  const jobsCompleted = profile.jobs_completed || 0;
  const showMessageBtn = !!user && user.id !== id;

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Purple header */}
      <div className="gradient-primary px-4 pt-6 pb-20 relative">
        <button
          onClick={() => navigate(-1)}
          className="text-primary-foreground mb-4"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <div
            className={`w-24 h-24 rounded-full bg-primary-foreground/20 mx-auto flex items-center justify-center mb-3 overflow-hidden ${
              profile.is_premium ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-primary" : ""
            }`}
          >
            {profile.avatar_url ? (
              <img src={profile.avatar_url} className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl font-bold text-primary-foreground">
                {profile.full_name?.charAt(0)?.toUpperCase() || "?"}
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-primary-foreground">
            {profile.full_name || "User"}
          </h1>
          <div className="flex items-center justify-center gap-2 mt-1.5 flex-wrap">
            {profile.is_premium && (
              <Badge className="bg-amber-400/25 text-amber-100 border-amber-400/30 text-[10px]">
                <Crown className="w-3 h-3 mr-1" /> Premium
              </Badge>
            )}
            {isWorker && identityApproved && (
              <Badge className="bg-emerald-500/90 text-white border-0 text-[10px] hover:bg-emerald-500/90">
                <ShieldCheck className="w-3 h-3 mr-1" /> Verified
              </Badge>
            )}
            {isWorker && workerType === "helper" && (
              <Badge className="bg-purple-500/90 text-white border-0 text-[10px] hover:bg-purple-500/90">
                Helper
              </Badge>
            )}
            <span className="text-primary-foreground/70 text-sm capitalize">{profile.role}</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 -mt-12 relative z-10 space-y-3">
        {/* Message button */}
        {showMessageBtn && (
          <Button
            onClick={startConversation}
            className="w-full h-12 rounded-xl gradient-primary text-primary-foreground shadow-card"
          >
            <MessageCircle className="w-4 h-4 mr-2" /> Message
          </Button>
        )}

        {/* Stats grid 2x2 */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="grid grid-cols-2 gap-3"
        >
          {isOwner ? (
            <>
              <StatCard icon={<Home className="w-4 h-4" />} value={jobsCompleted} label="Homes Cleaned" />
              <StatCard icon={<Users className="w-4 h-4" />} value={cleanersHired} label="Cleaners Hired" />
              <StatCard
                icon={<Star className="w-4 h-4" />}
                value={avgRatingGiven > 0 ? avgRatingGiven.toFixed(1) : "—"}
                label="Avg Rating Given"
              />
              <StatCard icon={<CalendarDays className="w-4 h-4" />} value={memberSince} label="Member Since" small />
            </>
          ) : (
            <>
              <StatCard
                icon={<Star className="w-4 h-4" />}
                value={avgRatingReceived > 0 ? avgRatingReceived.toFixed(1) : "—"}
                label="Avg Rating"
              />
              <StatCard icon={<Briefcase className="w-4 h-4" />} value={jobsCompleted} label="Jobs Completed" />
              {/* No Total Earned for public view */}
              <StatCard icon={<CalendarDays className="w-4 h-4" />} value={memberSince} label="Member Since" small />
              <StatCard
                icon={<DollarSign className="w-4 h-4" />}
                value={reviews.length}
                label="Reviews"
              />
            </>
          )}
        </motion.div>

        {/* Badges — unlocked only */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.08 }}>
          <PointsBadgesSection
            points={profile.points ?? 0}
            role={profile.role}
            workerType={workerType}
            identityApproved={identityApproved}
            publicView
          />
        </motion.div>

        {/* About Me */}
        {isWorker && (profile.bio || (profile.specialties?.length ?? 0) > 0) && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.12 }}
            className="bg-card rounded-2xl shadow-card p-4"
          >
            <h3 className="text-sm font-semibold text-foreground mb-2">About</h3>
            {profile.bio && <p className="text-sm text-muted-foreground">{profile.bio}</p>}
            {profile.specialties?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {profile.specialties.map((s: string) => (
                  <Badge key={s} variant="outline" className="text-[10px]">
                    {s}
                  </Badge>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.16 }}
            className="bg-card rounded-2xl shadow-card p-4"
          >
            <h3 className="text-sm font-semibold text-foreground mb-3">Reviews</h3>
            <div className="space-y-3">
              {reviews.map((r) => (
                <div key={r.id} className="border-b border-border pb-3 last:border-0">
                  <div className="flex items-center gap-1 mb-1">
                    {Array.from({ length: r.rating }).map((_, i) => (
                      <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  {r.review_text && (
                    <p className="text-sm text-muted-foreground">{r.review_text}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
  small,
}: {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
  small?: boolean;
}) {
  return (
    <div className="bg-card rounded-2xl shadow-card p-4">
      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2">
        {icon}
      </div>
      <p className={`font-bold text-foreground ${small ? "text-base" : "text-xl"}`}>{value}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

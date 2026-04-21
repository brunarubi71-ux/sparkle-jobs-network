import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import {
  ArrowLeft, Star, Crown, ShieldCheck, MessageCircle,
  Home, CalendarDays, Briefcase, Car, CarFront, Languages, Image as ImageIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import BadgeDisplay from "@/components/BadgeDisplay";
import { toast } from "sonner";

function formatMemberSince(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

interface ReviewRow {
  id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  reviewer_id: string;
  reviewer_name?: string;
  reviewer_avatar?: string | null;
}

interface PortfolioPhoto {
  id: string;
  photo_url: string;
  caption: string | null;
}

export default function PublicProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [avgRating, setAvgRating] = useState(0);
  const [jobsCompletedCount, setJobsCompletedCount] = useState(0);
  const [portfolio, setPortfolio] = useState<PortfolioPhoto[]>([]);

  useEffect(() => {
    if (!id) return;
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchAll = async () => {
    const { data: p } = await supabase.from("profiles").select("*").eq("id", id!).single();
    setProfile(p);
    if (!p) return;

    const isOwnerProfile = p.role === "owner";

    // Reviews + jobs completed (in parallel)
    const reviewsPromise = supabase
      .from("reviews")
      .select("id, rating, review_text, created_at, reviewer_id")
      .eq("reviewed_id", id!)
      .order("created_at", { ascending: false })
      .limit(5);

    const jobsCountPromise = isOwnerProfile
      ? supabase
          .from("jobs")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", id!)
          .eq("status", "completed")
      : supabase
          .from("jobs")
          .select("id", { count: "exact", head: true })
          .eq("hired_cleaner_id", id!)
          .eq("status", "completed");

    const portfolioPromise = !isOwnerProfile
      ? supabase
          .from("portfolio_photos")
          .select("id, photo_url, caption")
          .eq("user_id", id!)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as PortfolioPhoto[] });

    // Total review count for accurate avg
    const allRatingsPromise = supabase
      .from("reviews")
      .select("rating")
      .eq("reviewed_id", id!);

    const [
      { data: latestReviews },
      { count: completedCount },
      { data: portfolioData },
      { data: allRatings },
    ] = await Promise.all([reviewsPromise, jobsCountPromise, portfolioPromise, allRatingsPromise]);

    setJobsCompletedCount(completedCount || 0);
    setPortfolio((portfolioData as PortfolioPhoto[]) || []);

    const ratingsList = allRatings || [];
    setReviewCount(ratingsList.length);
    setAvgRating(
      ratingsList.length
        ? Math.round((ratingsList.reduce((s, r: any) => s + r.rating, 0) / ratingsList.length) * 10) / 10
        : 0
    );

    // Hydrate reviewer names
    const revs = (latestReviews as ReviewRow[]) || [];
    if (revs.length > 0) {
      const reviewerIds = Array.from(new Set(revs.map((r) => r.reviewer_id)));
      const { data: reviewers } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", reviewerIds);
      const map = new Map((reviewers || []).map((u: any) => [u.id, u]));
      setReviews(
        revs.map((r) => ({
          ...r,
          reviewer_name: (map.get(r.reviewer_id) as any)?.full_name || "Anonymous",
          reviewer_avatar: (map.get(r.reviewer_id) as any)?.avatar_url || null,
        }))
      );
    } else {
      setReviews([]);
    }
  };

  const startConversation = async () => {
    if (!user || !profile || !id) return;
    if (user.id === id) return;

    const meIsOwner = (await supabase.from("profiles").select("role").eq("id", user.id).single())
      .data?.role === "owner";
    const ownerId = meIsOwner ? user.id : id;
    const cleanerId = meIsOwner ? id : user.id;

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
  const showMessageBtn = !!user && user.id !== id;
  const hasTransport = profile.has_transportation ?? (profile.transportation && profile.transportation !== "none");
  const languages: string[] = profile.languages || [];
  const specialties: string[] = profile.specialties || [];
  const roleLabel = isOwner ? "Owner" : workerType === "helper" ? "Helper" : "Cleaner";

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
              <img src={profile.avatar_url} className="w-full h-full object-cover" alt={profile.full_name || "User"} />
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
            <Badge className="bg-primary-foreground/15 text-primary-foreground border-0 text-[10px]">
              {roleLabel}
            </Badge>
            {profile.is_premium && (
              <Badge className="bg-amber-400/25 text-amber-100 border-amber-400/30 text-[10px]">
                <Crown className="w-3 h-3 mr-1" /> {profile.plan_tier === "pro" ? "Pro" : "Premium"}
              </Badge>
            )}
            {identityApproved && (
              <Badge className="bg-emerald-500/90 text-white border-0 text-[10px] hover:bg-emerald-500/90">
                <ShieldCheck className="w-3 h-3 mr-1" /> Verified
              </Badge>
            )}
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

        {/* Key stats row */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="grid grid-cols-3 gap-3"
        >
          <StatCard
            icon={isOwner ? <Home className="w-4 h-4" /> : <Briefcase className="w-4 h-4" />}
            value={jobsCompletedCount}
            label="Jobs Completed"
          />
          <StatCard
            icon={<Star className="w-4 h-4" />}
            value={reviewCount > 0 ? avgRating.toFixed(1) : "—"}
            label={reviewCount > 0 ? `Avg Rating (${reviewCount})` : "No ratings yet"}
            small={reviewCount === 0}
          />
          <StatCard
            icon={<CalendarDays className="w-4 h-4" />}
            value={memberSince}
            label="Member Since"
            small
          />
        </motion.div>

        {/* About */}
        {(isWorker || workerType === "helper") && (profile.bio || specialties.length > 0 || languages.length > 0 || hasTransport !== undefined) && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.08 }}
            className="bg-card rounded-2xl shadow-card p-4 space-y-3"
          >
            <h3 className="text-sm font-semibold text-foreground">About</h3>
            {profile.bio && <p className="text-sm text-muted-foreground">{profile.bio}</p>}

            {specialties.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Specialties</p>
                <div className="flex flex-wrap gap-1">
                  {specialties.map((s) => (
                    <Badge key={s} variant="outline" className="text-[10px]">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {languages.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Languages className="w-3 h-3" /> Languages
                </p>
                <div className="flex flex-wrap gap-1">
                  {languages.map((l) => (
                    <Badge key={l} variant="outline" className="text-[10px]">
                      {l}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 text-sm">
              {hasTransport ? (
                <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px]">
                  <CarFront className="w-3 h-3 mr-1" /> Has car 🚗
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px]">
                  <Car className="w-3 h-3 mr-1" /> No car
                </Badge>
              )}
            </div>
          </motion.div>
        )}

        {/* Badges (earned from rewards table) */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.12 }}>
          <BadgeDisplay userId={id!} />
        </motion.div>

        {/* Portfolio */}
        {!isOwner && portfolio.length > 0 && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.14 }}
            className="bg-card rounded-2xl shadow-card p-4"
          >
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-primary" /> Portfolio ({portfolio.length})
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {portfolio.map((ph) => (
                <a
                  key={ph.id}
                  href={ph.photo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aspect-square rounded-xl overflow-hidden bg-muted block"
                >
                  <img
                    src={ph.photo_url}
                    alt={ph.caption || "Portfolio"}
                    className="w-full h-full object-cover hover:scale-105 transition-transform"
                  />
                </a>
              ))}
            </div>
          </motion.div>
        )}

        {/* Reviews */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.16 }}
          className="bg-card rounded-2xl shadow-card p-4"
        >
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Reviews {reviewCount > 0 && <span className="text-muted-foreground font-normal">({reviewCount})</span>}
          </h3>
          {reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reviews yet.</p>
          ) : (
            <div className="space-y-3">
              {reviews.map((r) => (
                <div key={r.id} className="border-b border-border pb-3 last:border-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-full bg-accent overflow-hidden flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">
                      {r.reviewer_avatar ? (
                        <img src={r.reviewer_avatar} alt={r.reviewer_name} className="w-full h-full object-cover" />
                      ) : (
                        (r.reviewer_name || "?").charAt(0).toUpperCase()
                      )}
                    </div>
                    <span className="text-xs font-medium text-foreground truncate">{r.reviewer_name}</span>
                    <div className="flex items-center gap-0.5 ml-auto">
                      {Array.from({ length: r.rating }).map((_, i) => (
                        <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
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
          )}
        </motion.div>
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
    <div className="bg-card rounded-2xl shadow-card p-3">
      <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-1.5">
        {icon}
      </div>
      <p className={`font-bold text-foreground ${small ? "text-sm" : "text-lg"}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{label}</p>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Star, Award, Briefcase, Crown, Image } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import BadgeDisplay from "@/components/BadgeDisplay";

export default function PublicProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [rewards, setRewards] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [avgRating, setAvgRating] = useState(0);

  useEffect(() => {
    if (!id) return;
    fetchAll();
  }, [id]);

  const fetchAll = async () => {
    const [profileRes, reviewsRes, rewardsRes, photosRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", id!).single(),
      supabase.from("reviews").select("*").eq("reviewed_id", id!).order("created_at", { ascending: false }),
      supabase.from("rewards").select("*").eq("user_id", id!),
      supabase.from("portfolio_photos").select("*").eq("user_id", id!).order("created_at", { ascending: false }),
    ]);
    setProfile(profileRes.data);
    setReviews(reviewsRes.data || []);
    setRewards(rewardsRes.data || []);
    setPhotos(photosRes.data || []);
    if (reviewsRes.data && reviewsRes.data.length > 0) {
      const avg = reviewsRes.data.reduce((sum: number, r: any) => sum + r.rating, 0) / reviewsRes.data.length;
      setAvgRating(Math.round(avg * 10) / 10);
    }
  };

  if (!profile) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="shimmer w-20 h-20 rounded-full" /></div>;

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="gradient-primary px-4 pt-6 pb-16 relative">
        <button onClick={() => navigate(-1)} className="text-primary-foreground mb-4"><ArrowLeft className="w-5 h-5" /></button>
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-primary-foreground/20 mx-auto flex items-center justify-center mb-3 overflow-hidden">
            {profile.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" /> :
              <span className="text-2xl font-bold text-primary-foreground">{profile.full_name?.charAt(0)?.toUpperCase() || "?"}</span>}
          </div>
          <h1 className="text-xl font-bold text-primary-foreground">{profile.full_name || "User"}</h1>
          <div className="flex items-center justify-center gap-2 mt-1">
            {profile.is_premium && <Badge className="bg-primary-foreground/20 text-primary-foreground border-0 text-[10px]"><Crown className="w-3 h-3 mr-1" /> Premium</Badge>}
            <span className="text-primary-foreground/70 text-sm capitalize">{profile.role}</span>
          </div>
          {avgRating > 0 && (
            <div className="flex items-center justify-center gap-1 mt-2">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span className="text-primary-foreground font-medium">{avgRating}</span>
              <span className="text-primary-foreground/70 text-xs">({reviews.length} reviews)</span>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 -mt-8 relative z-10 space-y-3">
        {/* Info */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-card rounded-2xl shadow-card p-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {profile.city && <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="w-4 h-4 text-primary" /> {profile.city}</div>}
            {profile.experience_years > 0 && <div className="flex items-center gap-2 text-muted-foreground"><Briefcase className="w-4 h-4 text-primary" /> {profile.experience_years} yrs exp</div>}
            <div className="flex items-center gap-2 text-muted-foreground"><Award className="w-4 h-4 text-primary" /> {profile.jobs_completed || 0} jobs done</div>
          </div>
          {profile.bio && <p className="text-sm text-muted-foreground mt-3">{profile.bio}</p>}
          {profile.specialties?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {profile.specialties.map((s: string) => <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>)}
            </div>
          )}
        </motion.div>

        {/* Rewards */}
        {id && (
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
            <BadgeDisplay userId={id} />
          </motion.div>
        )}

        {/* Portfolio */}
        {photos.length > 0 && (
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }} className="bg-card rounded-2xl shadow-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1"><Image className="w-4 h-4" /> Portfolio</h3>
            <div className="grid grid-cols-3 gap-2">
              {photos.map(p => <img key={p.id} src={p.photo_url} className="w-full aspect-square object-cover rounded-xl" />)}
            </div>
          </motion.div>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="bg-card rounded-2xl shadow-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Reviews</h3>
            <div className="space-y-3">
              {reviews.map(r => (
                <div key={r.id} className="border-b border-border pb-3 last:border-0">
                  <div className="flex items-center gap-1 mb-1">
                    {Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />)}
                  </div>
                  {r.review_text && <p className="text-sm text-muted-foreground">{r.review_text}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">{new Date(r.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  Crown, Star, LogOut, Camera, FileText,
  ShieldCheck, Clock, ShieldAlert, Sparkles, Home, Users,
  DollarSign, CalendarDays, Briefcase, Pencil,
} from "lucide-react";
import TermsModal from "@/components/TermsModal";
import IdentityVerificationModal from "@/components/IdentityVerificationModal";
import EditProfileModal from "@/components/EditProfileModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import BottomNav from "@/components/BottomNav";
import PointsBadgesSection from "@/components/PointsBadgesSection";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import { awardPoints } from "@/lib/points";

function formatMemberSince(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export default function Profile() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [editOpen, setEditOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [avgRatingReceived, setAvgRatingReceived] = useState(0);
  const [avgRatingGiven, setAvgRatingGiven] = useState(0);
  const [cleanersHired, setCleanersHired] = useState(0);

  useEffect(() => {
    if (user && profile) fetchExtras();
  }, [user, profile?.role]);

  const fetchExtras = async () => {
    if (!user || !profile) return;

    if (profile.role === "owner") {
      const { data: given } = await supabase
        .from("reviews")
        .select("rating, reviewed_id")
        .eq("reviewer_id", user.id);
      const givenList = given || [];
      setAvgRatingGiven(
        givenList.length
          ? Math.round((givenList.reduce((s, r: any) => s + r.rating, 0) / givenList.length) * 10) / 10
          : 0
      );
      const { data: hiredJobs } = await supabase
        .from("jobs")
        .select("hired_cleaner_id")
        .eq("owner_id", user.id)
        .not("hired_cleaner_id", "is", null);
      const distinct = new Set((hiredJobs || []).map((j: any) => j.hired_cleaner_id));
      setCleanersHired(distinct.size);
    } else {
      const { data: received } = await supabase
        .from("reviews")
        .select("*")
        .eq("reviewed_id", user.id)
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

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    const wasEmpty = !(profile as any)?.avatar_url;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) {
      toast.error(t("job.upload_failed"));
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id);
    await refreshProfile();
    toast.success(t("profile.photo_updated"));

    // First-time photo bonus: +20 pts (one-time, tracked via point_history)
    if (wasEmpty) {
      const { data: existing } = await supabase
        .from("point_history")
        .select("id")
        .eq("user_id", user.id)
        .eq("reason", "profile_complete")
        .maybeSingle();
      if (!existing) {
        await awardPoints(user.id, "profile_complete");
        await refreshProfile();
      }
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  if (!profile) return null;

  const isOwner = profile.role === "owner";
  const isWorker = profile.role === "cleaner";
  const workerType = (profile as any)?.worker_type || "cleaner";
  const avatarUrl = (profile as any)?.avatar_url;
  const identityStatus = (profile as any)?.identity_status || "unverified";
  const memberSince = formatMemberSince((profile as any)?.created_at);
  const jobsCompleted = (profile as any)?.jobs_completed || 0;
  const totalEarnings = (profile as any)?.total_earnings || 0;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* ── Purple header ── */}
      <div className="gradient-primary px-4 pt-8 pb-20 text-center relative">
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="absolute top-4 right-4 text-primary-foreground/80 hover:text-primary-foreground"
          >
            <Edit2 className="w-5 h-5" />
          </button>
        ) : (
          <div className="absolute top-4 right-4 flex gap-2">
            <button onClick={saveProfile} disabled={saving} className="text-primary-foreground">
              <Save className="w-5 h-5" />
            </button>
            <button onClick={() => setEditing(false)} className="text-primary-foreground/80">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Avatar 96px */}
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`w-24 h-24 rounded-full bg-primary-foreground/20 mx-auto flex items-center justify-center mb-3 overflow-hidden relative ${
            profile.is_premium ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-primary" : ""
          }`}
        >
          {avatarUrl ? (
            <img src={avatarUrl} className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl font-bold text-primary-foreground">
              {profile.full_name?.charAt(0)?.toUpperCase() || "?"}
            </span>
          )}
          <label className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-card flex items-center justify-center cursor-pointer shadow-md hover:scale-105 transition-transform">
            <Camera className="w-4 h-4 text-primary" />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])}
            />
          </label>
        </motion.div>

        {editing ? (
          <Input
            value={form.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            className="bg-primary-foreground/20 border-0 text-primary-foreground text-center rounded-xl h-10 max-w-xs mx-auto"
          />
        ) : (
          <h1 className="text-xl font-bold text-primary-foreground">{profile.full_name || "User"}</h1>
        )}

        <div className="flex items-center justify-center gap-2 mt-1.5 flex-wrap">
          {profile.is_premium && (
            <Badge className="bg-amber-400/25 text-amber-100 border-amber-400/30 text-[10px]">
              <Crown className="w-3 h-3 mr-1" /> Premium
            </Badge>
          )}
          {isWorker && identityStatus === "approved" && (
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

      {/* ── Body ── */}
      <div className="px-4 -mt-12 relative z-10 space-y-3">
        {/* Add-photo incentive banner */}
        {!avatarUrl && (
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center gap-3 shadow-card"
          >
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">📸 Add your photo</p>
              <p className="text-xs text-amber-700">Earn +20 points instantly!</p>
            </div>
            <label className="text-xs font-semibold text-primary cursor-pointer px-3 py-1.5 rounded-lg bg-card shadow-sm">
              Add
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])}
              />
            </label>
          </motion.div>
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
              <StatCard
                icon={<DollarSign className="w-4 h-4" />}
                value={`$${Number(totalEarnings).toFixed(0)}`}
                label="Total Earned"
              />
              <StatCard icon={<CalendarDays className="w-4 h-4" />} value={memberSince} label="Member Since" small />
            </>
          )}
        </motion.div>

        {/* Identity verification (workers only) */}
        {isWorker && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.05 }}
            className="bg-card rounded-2xl shadow-card p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Identity Verification</h3>
              </div>
              {identityStatus === "approved" && (
                <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px]">
                  <ShieldCheck className="w-3 h-3 mr-1" /> Verified
                </Badge>
              )}
              {identityStatus === "pending" && (
                <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px]">
                  <Clock className="w-3 h-3 mr-1" /> Pending
                </Badge>
              )}
              {identityStatus === "rejected" && (
                <Badge className="bg-destructive/10 text-destructive border-0 text-[10px]">
                  <ShieldAlert className="w-3 h-3 mr-1" /> Rejected
                </Badge>
              )}
              {identityStatus === "unverified" && (
                <Badge variant="outline" className="text-[10px]">Not verified</Badge>
              )}
            </div>
            {(identityStatus === "unverified" || identityStatus === "rejected") && (
              <Button
                onClick={() => setIdentityOpen(true)}
                className="w-full mt-3 h-10 rounded-xl gradient-primary text-primary-foreground"
              >
                Verify Identity
              </Button>
            )}
            {identityStatus === "pending" && (
              <p className="text-xs text-muted-foreground mt-2">
                Your documents are under review. You'll be notified within 24 hours.
              </p>
            )}
          </motion.div>
        )}

        {/* Badges (already implemented) */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.08 }}>
          <PointsBadgesSection
            points={(profile as any)?.points ?? 0}
            role={profile.role as string}
            workerType={workerType}
            identityApproved={identityStatus === "approved"}
          />
        </motion.div>

        {/* About Me — workers only */}
        {isWorker && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.12 }}
            className="bg-card rounded-2xl shadow-card p-4"
          >
            <h3 className="text-sm font-semibold text-foreground mb-3">About Me</h3>
            {editing ? (
              <div className="space-y-3">
                <Input
                  placeholder="City"
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  className="rounded-xl h-10"
                />
                <Textarea
                  placeholder="Tell owners about yourself..."
                  value={form.bio}
                  onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                  className="rounded-xl min-h-[80px]"
                />
                <Input
                  placeholder="Specialties (comma-separated)"
                  value={form.specialties}
                  onChange={(e) => setForm((f) => ({ ...f, specialties: e.target.value }))}
                  className="rounded-xl h-10"
                />
              </div>
            ) : (
              <div className="space-y-2">
                {(profile as any)?.bio ? (
                  <p className="text-sm text-muted-foreground">{(profile as any).bio}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    Add a short bio so owners get to know you.
                  </p>
                )}
                {(profile as any)?.specialties?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(profile as any).specialties.map((s: string) => (
                      <Badge key={s} variant="outline" className="text-[10px]">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* Reviews list — workers only */}
        {isWorker && reviews.length > 0 && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.16 }}
            className="bg-card rounded-2xl shadow-card p-4"
          >
            <h3 className="text-sm font-semibold text-foreground mb-3">{t("profile.reviews")}</h3>
            {reviews.slice(0, 5).map((r) => (
              <div key={r.id} className="border-b border-border pb-2 mb-2 last:border-0 last:mb-0">
                <div className="flex gap-0.5 mb-1">
                  {Array.from({ length: r.rating }).map((_, i) => (
                    <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                {r.review_text && <p className="text-xs text-muted-foreground">{r.review_text}</p>}
              </div>
            ))}
          </motion.div>
        )}

        {/* Logout */}
        <Button
          variant="outline"
          className="w-full h-12 rounded-xl border-border text-muted-foreground"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 mr-2" /> {t("profile.logout")}
        </Button>

        {/* Terms */}
        <button
          onClick={() => setTermsOpen(true)}
          className="w-full flex items-center justify-center gap-2 text-xs text-primary hover:underline pt-1 pb-2"
        >
          <FileText className="w-3 h-3" />
          {t("auth.terms_of_service")}
        </button>
      </div>

      <TermsModal
        open={termsOpen}
        onOpenChange={setTermsOpen}
        defaultTab={(localStorage.getItem("shinely_lang") as "en" | "pt" | "es") || "en"}
      />
      <IdentityVerificationModal open={identityOpen} onOpenChange={setIdentityOpen} />
      <BottomNav />
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

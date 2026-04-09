import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Crown, MapPin, Briefcase, Star, LogOut, Award, Camera, DollarSign, Edit2, Save, X, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import BottomNav from "@/components/BottomNav";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function Profile() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [rewards, setRewards] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "", city: "", phone: "", bio: "",
    experience_years: 0, specialties: "" as string,
    languages: "" as string, regions: "" as string,
    availability: "full-time", transportation: "car", supplies: true,
    company_name: "", business_type: "", years_in_business: 0,
  });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || "",
        city: profile.city || "",
        phone: profile.phone || "",
        bio: (profile as any).bio || "",
        experience_years: (profile as any).experience_years || 0,
        specialties: ((profile as any).specialties || []).join(", "),
        languages: ((profile as any).languages || []).join(", "),
        regions: ((profile as any).regions || []).join(", "),
        availability: (profile as any).availability || "full-time",
        transportation: (profile as any).transportation || "car",
        supplies: (profile as any).supplies ?? true,
        company_name: (profile as any).company_name || "",
        business_type: (profile as any).business_type || "",
        years_in_business: (profile as any).years_in_business || 0,
      });
    }
  }, [profile]);

  useEffect(() => {
    if (user) fetchExtras();
  }, [user]);

  const fetchExtras = async () => {
    const [reviewsRes, rewardsRes, photosRes] = await Promise.all([
      supabase.from("reviews").select("*").eq("reviewed_id", user!.id).order("created_at", { ascending: false }),
      supabase.from("rewards").select("*").eq("user_id", user!.id),
      supabase.from("portfolio_photos").select("*").eq("user_id", user!.id),
    ]);
    setReviews(reviewsRes.data || []);
    setRewards(rewardsRes.data || []);
    setPhotos(photosRes.data || []);
    if (reviewsRes.data && reviewsRes.data.length > 0) {
      setAvgRating(Math.round(reviewsRes.data.reduce((s: number, r: any) => s + r.rating, 0) / reviewsRes.data.length * 10) / 10);
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const updates: any = {
        full_name: form.full_name,
        city: form.city,
        phone: form.phone,
        bio: form.bio,
        experience_years: form.experience_years,
        specialties: form.specialties.split(",").map(s => s.trim()).filter(Boolean),
        languages: form.languages.split(",").map(s => s.trim()).filter(Boolean),
        regions: form.regions.split(",").map(s => s.trim()).filter(Boolean),
        availability: form.availability,
        transportation: form.transportation,
        supplies: form.supplies,
        company_name: form.company_name,
        business_type: form.business_type,
        years_in_business: form.years_in_business,
      };
      await supabase.from("profiles").update(updates).eq("id", user.id);
      await refreshProfile();
      setEditing(false);
      toast.success("Profile updated!");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) { toast.error("Upload failed"); return; }
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id);
    await refreshProfile();
    toast.success("Photo updated!");
  };

  const uploadPortfolioPhoto = async (file: File) => {
    if (!user) return;
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("portfolio").upload(path, file);
    if (error) { toast.error("Upload failed"); return; }
    const { data: { publicUrl } } = supabase.storage.from("portfolio").getPublicUrl(path);
    await supabase.from("portfolio_photos").insert({ user_id: user.id, photo_url: publicUrl });
    fetchExtras();
    toast.success("Photo added!");
  };

  const handleLogout = async () => { await signOut(); navigate("/auth"); };

  const isCleaner = profile?.role === "cleaner";

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="gradient-primary px-4 pt-8 pb-16 text-center relative">
        {!editing ? (
          <button onClick={() => setEditing(true)} className="absolute top-4 right-4 text-primary-foreground/70 hover:text-primary-foreground">
            <Edit2 className="w-5 h-5" />
          </button>
        ) : (
          <div className="absolute top-4 right-4 flex gap-2">
            <button onClick={saveProfile} disabled={saving} className="text-primary-foreground"><Save className="w-5 h-5" /></button>
            <button onClick={() => setEditing(false)} className="text-primary-foreground/70"><X className="w-5 h-5" /></button>
          </div>
        )}
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="w-20 h-20 rounded-full bg-primary-foreground/20 mx-auto flex items-center justify-center mb-3 overflow-hidden relative"
        >
          {(profile as any)?.avatar_url ? <img src={(profile as any).avatar_url} className="w-full h-full object-cover" /> :
            <span className="text-2xl font-bold text-primary-foreground">{profile?.full_name?.charAt(0)?.toUpperCase() || "?"}</span>}
          <label className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-card flex items-center justify-center cursor-pointer shadow-md">
            <Camera className="w-3.5 h-3.5 text-primary" />
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
          </label>
        </motion.div>
        {editing ? (
          <Input value={form.full_name} onChange={(e) => setForm(f => ({ ...f, full_name: e.target.value }))}
            className="bg-primary-foreground/20 border-0 text-primary-foreground text-center rounded-xl h-10 max-w-xs mx-auto" />
        ) : (
          <h1 className="text-xl font-bold text-primary-foreground">{profile?.full_name || "User"}</h1>
        )}
        <div className="flex items-center justify-center gap-2 mt-1">
          {profile?.is_premium && <Badge className="bg-primary-foreground/20 text-primary-foreground border-0 text-[10px]"><Crown className="w-3 h-3 mr-1" /> Premium</Badge>}
          <span className="text-primary-foreground/70 text-sm capitalize">{profile?.role}</span>
        </div>
        {avgRating > 0 && (
          <div className="flex items-center justify-center gap-1 mt-2">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            <span className="text-primary-foreground font-medium">{avgRating}</span>
            <span className="text-primary-foreground/70 text-xs">({reviews.length})</span>
          </div>
        )}
      </div>

      <div className="px-4 -mt-8 relative z-10 space-y-3">
        {/* Editable Details */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-card rounded-2xl shadow-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Details</h3>
          {editing ? (
            <div className="space-y-3">
              <Input placeholder="City" value={form.city} onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))} className="rounded-xl h-10" />
              <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} className="rounded-xl h-10" />
              <Textarea placeholder="Bio" value={form.bio} onChange={(e) => setForm(f => ({ ...f, bio: e.target.value }))} className="rounded-xl" />
              {isCleaner ? (
                <>
                  <Input placeholder="Experience (years)" type="number" value={form.experience_years} onChange={(e) => setForm(f => ({ ...f, experience_years: parseInt(e.target.value) || 0 }))} className="rounded-xl h-10" />
                  <Input placeholder="Specialties (comma separated)" value={form.specialties} onChange={(e) => setForm(f => ({ ...f, specialties: e.target.value }))} className="rounded-xl h-10" />
                  <Input placeholder="Languages (comma separated)" value={form.languages} onChange={(e) => setForm(f => ({ ...f, languages: e.target.value }))} className="rounded-xl h-10" />
                  <Input placeholder="Regions (comma separated)" value={form.regions} onChange={(e) => setForm(f => ({ ...f, regions: e.target.value }))} className="rounded-xl h-10" />
                  <Input placeholder="Availability" value={form.availability} onChange={(e) => setForm(f => ({ ...f, availability: e.target.value }))} className="rounded-xl h-10" />
                  <Input placeholder="Transportation" value={form.transportation} onChange={(e) => setForm(f => ({ ...f, transportation: e.target.value }))} className="rounded-xl h-10" />
                </>
              ) : (
                <>
                  <Input placeholder="Company Name" value={form.company_name} onChange={(e) => setForm(f => ({ ...f, company_name: e.target.value }))} className="rounded-xl h-10" />
                  <Input placeholder="Business Type" value={form.business_type} onChange={(e) => setForm(f => ({ ...f, business_type: e.target.value }))} className="rounded-xl h-10" />
                  <Input placeholder="Years in Business" type="number" value={form.years_in_business} onChange={(e) => setForm(f => ({ ...f, years_in_business: parseInt(e.target.value) || 0 }))} className="rounded-xl h-10" />
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="w-4 h-4 text-primary" /> {profile?.city || "Not set"}</div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Briefcase className="w-4 h-4 text-primary" /> {isCleaner ? "Cleaner" : (profile as any)?.company_name || "Job Owner"}</div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Award className="w-4 h-4 text-primary" /> {(profile as any)?.jobs_completed || 0} jobs completed</div>
              {(profile as any)?.bio && <p className="text-sm text-muted-foreground mt-2">{(profile as any).bio}</p>}
              {(profile as any)?.specialties?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {(profile as any).specialties.map((s: string) => <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>)}
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* Stats */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="bg-card rounded-2xl shadow-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Earnings & Stats</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-bold text-foreground">${((profile as any)?.total_earnings || 0).toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Total earnings</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{(profile as any)?.jobs_completed || 0}</p>
              <p className="text-xs text-muted-foreground">Jobs completed</p>
            </div>
          </div>
        </motion.div>

        {/* Rewards */}
        {rewards.length > 0 && (
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }} className="bg-card rounded-2xl shadow-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-2">Badges</h3>
            <div className="flex flex-wrap gap-2">
              {rewards.map(r => <Badge key={r.id} className="bg-accent text-primary border-0">{r.badge_name}</Badge>)}
            </div>
          </motion.div>
        )}

        {/* Portfolio (cleaners) */}
        {isCleaner && (
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="bg-card rounded-2xl shadow-card p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1"><ImageIcon className="w-4 h-4" /> Portfolio</h3>
              <label className="text-xs text-primary cursor-pointer font-medium">
                + Add Photo
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadPortfolioPhoto(e.target.files[0])} />
              </label>
            </div>
            {photos.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {photos.map(p => <img key={p.id} src={p.photo_url} className="w-full aspect-square object-cover rounded-xl" />)}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Upload photos of your work to attract more clients</p>
            )}
          </motion.div>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }} className="bg-card rounded-2xl shadow-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Reviews</h3>
            {reviews.slice(0, 5).map(r => (
              <div key={r.id} className="border-b border-border pb-2 mb-2 last:border-0 last:mb-0">
                <div className="flex gap-0.5 mb-1">{Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />)}</div>
                {r.review_text && <p className="text-xs text-muted-foreground">{r.review_text}</p>}
              </div>
            ))}
          </motion.div>
        )}

        <Button variant="outline" className="w-full h-12 rounded-xl border-border text-muted-foreground" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" /> Log Out
        </Button>
      </div>

      <BottomNav />
    </div>
  );
}

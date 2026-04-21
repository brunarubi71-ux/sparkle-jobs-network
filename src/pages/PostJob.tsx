import { useState } from "react";
import { containsContactInfo } from "@/lib/contactFilter";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import BottomNav from "@/components/BottomNav";
import IdentityVerificationModal from "@/components/IdentityVerificationModal";
import { toast } from "sonner";
import { PlusCircle, Camera, X, Upload, Star, ShieldAlert } from "lucide-react";
import { awardPoints } from "@/lib/points";
import { useLanguage } from "@/i18n/LanguageContext";

export default function PostJob() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const ownerIdentityStatus = (profile as any)?.identity_status || "unverified";
  // Block submission if not approved, but only show the banner for unverified/rejected (not pending — that lives on Profile)
  const ownerNeedsVerification = profile?.role === "owner" && ownerIdentityStatus !== "approved";
  const showOwnerVerifyBanner = profile?.role === "owner" && (ownerIdentityStatus === "unverified" || ownerIdentityStatus === "rejected");
  const [mainPhotoFile, setMainPhotoFile] = useState<File | null>(null);
  const [mainPhotoPreview, setMainPhotoPreview] = useState<string>("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [form, setForm] = useState({
    title: "", cleaning_type: "residential", price: "",
    bedrooms: "1", bathrooms: "1", address: "", city: "",
    urgency: "scheduled", description: "", team_size: "1",
    door_code: "", supply_code: "", lockbox_code: "", gate_code: "",
    alarm_instructions: "", parking_instructions: "", door_access_info: "",
    guest_stay_length: "", number_of_guests: "",
  });

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const handleMainPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (mainPhotoPreview) URL.revokeObjectURL(mainPhotoPreview);
    setMainPhotoFile(file);
    setMainPhotoPreview(URL.createObjectURL(file));
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (photoFiles.length + files.length > 10) {
      toast.error(t("post.max_photos"));
      return;
    }
    setPhotoFiles((prev) => [...prev, ...files]);
    setPhotoPreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
  };

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(photoPreviews[index]);
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadFile = async (file: File, folder: string): Promise<string> => {
    const ext = file.name.split(".").pop();
    const path = `${user!.id}/${folder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("property-photos").upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from("property-photos").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (ownerNeedsVerification) {
      setIdentityOpen(true);
      return;
    }
    if (containsContactInfo(form.description) || containsContactInfo(form.title) || containsContactInfo(form.address)) {
      toast.error(t("security.contact_blocked"));
      return;
    }
    if (!mainPhotoFile) {
      toast.error(t("post.main_photo_required"));
      return;
    }
    setLoading(true);
    setUploadingPhotos(true);
    try {
      const price = parseFloat(form.price) || 0;
      const platformFee = Math.round(price * 0.1 * 100) / 100;
      const cleanerEarnings = Math.round((price - platformFee) * 100) / 100;

      const mainPhotoUrl = await uploadFile(mainPhotoFile, "main");
      const additionalUrls: string[] = [];
      for (const file of photoFiles) {
        additionalUrls.push(await uploadFile(file, "additional"));
      }
      setUploadingPhotos(false);

      const { error } = await supabase.from("jobs").insert({
        owner_id: user.id, title: form.title, cleaning_type: form.cleaning_type,
        price, bedrooms: parseInt(form.bedrooms), bathrooms: parseInt(form.bathrooms),
        address: form.address || null, city: form.city || null, urgency: form.urgency,
        description: form.description || null, total_amount: price,
        platform_fee: platformFee, cleaner_earnings: cleanerEarnings,
        team_size_required: parseInt(form.team_size) || 1,
        main_property_photo: mainPhotoUrl,
        property_photos: additionalUrls.length > 0 ? additionalUrls : null,
        door_code: form.door_code || null,
        supply_code: form.supply_code || null,
        lockbox_code: form.lockbox_code || null,
        gate_code: form.gate_code || null,
        alarm_instructions: form.alarm_instructions || null,
        parking_instructions: form.parking_instructions || null,
        door_access_info: form.door_access_info || null,
        number_of_guests: form.number_of_guests ? parseInt(form.number_of_guests) : null,
        guest_stay_length: form.guest_stay_length ? parseInt(form.guest_stay_length) : null,
      } as any);
      if (error) throw error;
      // Award owner points for posting a job
      try { await awardPoints(user.id, "job_posted"); } catch {}
      toast.success(t("post.success"));
      navigate("/my-jobs");
    } catch { toast.error(t("post.error")); } finally { setLoading(false); setUploadingPhotos(false); }
  };

  const isAirbnb = form.cleaning_type === "airbnb";

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="gradient-primary px-4 pt-8 pb-6">
        <h1 className="text-xl font-bold text-primary-foreground">{t("post.title")}</h1>
        <p className="text-primary-foreground/70 text-sm">{t("post.subtitle")}</p>
      </div>

      <motion.form initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleSubmit} className="px-4 mt-4 space-y-4">
        {showOwnerVerifyBanner && (
          <button
            type="button"
            onClick={() => setIdentityOpen(true)}
            className="w-full text-left bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 shadow-card hover:bg-amber-100 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">
                Verify your identity to post jobs
              </p>
              <p className="text-xs text-amber-700">
                Required before posting your first job. Earn +30 points!
              </p>
            </div>
            <span className="text-xs font-semibold text-primary px-3 py-1.5 rounded-lg bg-card shadow-sm">
              Verify
            </span>
          </button>
        )}
        {/* Basic Info */}
        <div className="bg-card rounded-2xl shadow-card p-4 space-y-4">
          <Input placeholder={t("post.job_title")} value={form.title} onChange={(e) => update("title", e.target.value)} required className="rounded-xl h-12" />
          <div className="grid grid-cols-2 gap-3">
            <Select value={form.cleaning_type} onValueChange={(v) => update("cleaning_type", v)}>
              <SelectTrigger className="rounded-xl h-12"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="residential">{t("post.residential")}</SelectItem>
                <SelectItem value="airbnb">{t("post.airbnb")}</SelectItem>
                <SelectItem value="commercial">{t("post.commercial")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={form.urgency} onValueChange={(v) => update("urgency", v)}>
              <SelectTrigger className="rounded-xl h-12"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">{t("post.scheduled")}</SelectItem>
                <SelectItem value="asap">{t("jobs.asap")}</SelectItem>
                <SelectItem value="urgent">{t("jobs.urgent")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input placeholder={t("post.price")} type="number" value={form.price} onChange={(e) => update("price", e.target.value)} required className="rounded-xl h-12" />
          {form.price && parseFloat(form.price) > 0 && (
            <div className="bg-accent rounded-xl p-3 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">{t("post.total")}</span><span className="font-medium text-foreground">${parseFloat(form.price).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t("post.platform_fee")}</span><span className="text-destructive">-${(parseFloat(form.price) * 0.1).toFixed(2)}</span></div>
              <div className="flex justify-between border-t border-border pt-1"><span className="text-muted-foreground">{t("post.cleaner_receives")}</span><span className="font-bold text-primary">${(parseFloat(form.price) * 0.9).toFixed(2)}</span></div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">{t("post.bedrooms")}</Label>
              <Input placeholder="1" type="number" value={form.bedrooms} onChange={(e) => update("bedrooms", e.target.value)} className="rounded-xl h-12" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">{t("post.bathrooms")}</Label>
              <Input placeholder="1" type="number" value={form.bathrooms} onChange={(e) => update("bathrooms", e.target.value)} className="rounded-xl h-12" />
            </div>
          </div>
          <Input placeholder={t("post.address")} value={form.address} onChange={(e) => update("address", e.target.value)} className="rounded-xl h-12" />
          <Input placeholder={t("post.city")} value={form.city} onChange={(e) => update("city", e.target.value)} className="rounded-xl h-12" />
          <Textarea placeholder={t("post.description")} value={form.description} onChange={(e) => update("description", e.target.value)} className="rounded-xl min-h-[80px]" />
          <div>
            <p className="text-sm font-medium text-foreground mb-2">{t("post.cleaners_needed")}</p>
            <Select value={form.team_size} onValueChange={(v) => update("team_size", v)}>
              <SelectTrigger className="rounded-xl h-12"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">{t("post.solo")}</SelectItem>
                <SelectItem value="2">{t("post.team2")}</SelectItem>
                <SelectItem value="3">{t("post.team3")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Main Property Photo */}
        <div className="bg-card rounded-2xl shadow-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-primary" />
            <p className="text-sm font-semibold text-foreground">{t("post.main_photo")} *</p>
          </div>
          <p className="text-xs text-muted-foreground">{t("post.main_photo_hint")}</p>

          {mainPhotoPreview ? (
            <div className="relative aspect-video rounded-xl overflow-hidden border border-border">
              <img src={mainPhotoPreview} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => { URL.revokeObjectURL(mainPhotoPreview); setMainPhotoFile(null); setMainPhotoPreview(""); }} className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-primary/30 rounded-xl p-6 cursor-pointer hover:border-primary/50 transition-colors bg-primary/5">
              <Camera className="w-6 h-6 text-primary" />
              <span className="text-sm font-medium text-primary">{t("post.select_main_photo")}</span>
              <input type="file" accept="image/*" onChange={handleMainPhotoSelect} className="hidden" />
            </label>
          )}
        </div>

        {/* Additional Photos */}
        <div className="bg-card rounded-2xl shadow-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            <p className="text-sm font-semibold text-foreground">{t("post.additional_photos")}</p>
          </div>
          <p className="text-xs text-muted-foreground">{t("post.additional_photos_hint")}</p>

          {photoPreviews.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photoPreviews.map((src, i) => (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-border">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removePhoto(i)} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <label className="flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl p-4 cursor-pointer hover:border-primary/50 transition-colors">
            <Upload className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{t("post.upload_photos")}</span>
            <input type="file" accept="image/*" multiple onChange={handlePhotoSelect} className="hidden" />
          </label>
          <p className="text-xs text-muted-foreground text-center">{t("post.max_photos_label")}</p>
        </div>

        {/* Access & Property Details */}
        <div className="bg-card rounded-2xl shadow-card p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">{t("post.access_details")}</p>
          <p className="text-xs text-muted-foreground">{t("post.access_details_hint")}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("post.door_code")}</Label>
              <Input placeholder="e.g. #1234" value={form.door_code} onChange={(e) => update("door_code", e.target.value)} className="rounded-xl h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("post.supply_code")}</Label>
              <Input placeholder="e.g. #5678" value={form.supply_code} onChange={(e) => update("supply_code", e.target.value)} className="rounded-xl h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("post.lockbox_code")}</Label>
              <Input placeholder="e.g. 9999" value={form.lockbox_code} onChange={(e) => update("lockbox_code", e.target.value)} className="rounded-xl h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("post.gate_code")}</Label>
              <Input placeholder="e.g. *456" value={form.gate_code} onChange={(e) => update("gate_code", e.target.value)} className="rounded-xl h-10" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("post.alarm_instructions")}</Label>
            <Textarea placeholder={t("post.alarm_placeholder")} value={form.alarm_instructions} onChange={(e) => update("alarm_instructions", e.target.value)} className="rounded-xl min-h-[60px]" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("post.parking_instructions")}</Label>
            <Textarea placeholder={t("post.parking_placeholder")} value={form.parking_instructions} onChange={(e) => update("parking_instructions", e.target.value)} className="rounded-xl min-h-[60px]" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("post.additional_notes")}</Label>
            <Textarea placeholder={t("post.additional_notes_placeholder")} value={form.door_access_info} onChange={(e) => update("door_access_info", e.target.value)} className="rounded-xl min-h-[60px]" />
          </div>
        </div>

        {/* Airbnb Details */}
        {isAirbnb && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="bg-card rounded-2xl shadow-card p-4 space-y-3 border border-primary/20">
            <p className="text-sm font-semibold text-primary">{t("post.airbnb_details")}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-foreground">{t("post.guest_stay_length")}</Label>
                <Input placeholder="3" type="number" value={form.guest_stay_length} onChange={(e) => update("guest_stay_length", e.target.value)} className="rounded-xl h-12" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-foreground">{t("post.number_of_guests")}</Label>
                <Input placeholder="2" type="number" value={form.number_of_guests} onChange={(e) => update("number_of_guests", e.target.value)} className="rounded-xl h-12" />
              </div>
            </div>
          </motion.div>
        )}

        <Button type="submit" disabled={loading || uploadingPhotos} className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold hover:opacity-90">
          <PlusCircle className="w-4 h-4 mr-2" />
          {uploadingPhotos ? t("post.uploading_photos") : loading ? t("post.posting") : t("post.submit")}
        </Button>
      </motion.form>
      <IdentityVerificationModal open={identityOpen} onOpenChange={setIdentityOpen} />
      <BottomNav />
    </div>
  );
}

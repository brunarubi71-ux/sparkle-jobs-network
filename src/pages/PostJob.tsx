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
import BottomNav from "@/components/BottomNav";
import { toast } from "sonner";
import { PlusCircle, Camera, X, Upload } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

export default function PostJob() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [form, setForm] = useState({
    title: "", cleaning_type: "residential", price: "",
    bedrooms: "1", bathrooms: "1", address: "", city: "",
    urgency: "scheduled", description: "", team_size: "1",
    door_access_info: "",
    guest_stay_length: "", number_of_guests: "",
  });

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (photoFiles.length + files.length > 10) {
      toast.error(t("post.max_photos"));
      return;
    }
    const newFiles = [...photoFiles, ...files];
    setPhotoFiles(newFiles);
    const newPreviews = files.map((f) => URL.createObjectURL(f));
    setPhotoPreviews((prev) => [...prev, ...newPreviews]);
  };

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(photoPreviews[index]);
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadPhotos = async (): Promise<string[]> => {
    if (!user || photoFiles.length === 0) return [];
    setUploadingPhotos(true);
    const urls: string[] = [];
    for (const file of photoFiles) {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("property-photos").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("property-photos").getPublicUrl(path);
      urls.push(urlData.publicUrl);
    }
    setUploadingPhotos(false);
    return urls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (containsContactInfo(form.description) || containsContactInfo(form.title) || containsContactInfo(form.address)) {
      toast.error(t("security.contact_blocked"));
      return;
    }
    setLoading(true);
    try {
      const price = parseFloat(form.price) || 0;
      const platformFee = Math.round(price * 0.1 * 100) / 100;
      const cleanerEarnings = Math.round((price - platformFee) * 100) / 100;

      const propertyPhotos = await uploadPhotos();

      const ownerInstructions = form.cleaning_type === "airbnb"
        ? `Guest Stay: ${form.guest_stay_length} days, Guests: ${form.number_of_guests}`
        : null;

      const { error } = await supabase.from("jobs").insert({
        owner_id: user.id, title: form.title, cleaning_type: form.cleaning_type,
        price, bedrooms: parseInt(form.bedrooms), bathrooms: parseInt(form.bathrooms),
        address: form.address || null, city: form.city || null, urgency: form.urgency,
        description: form.description || null, total_amount: price,
        platform_fee: platformFee, cleaner_earnings: cleanerEarnings,
        team_size_required: parseInt(form.team_size) || 1,
        property_photos: propertyPhotos.length > 0 ? propertyPhotos : null,
        door_access_info: form.door_access_info || null,
        owner_instructions: ownerInstructions,
      });
      if (error) throw error;
      toast.success(t("post.success"));
      navigate("/my-jobs");
    } catch { toast.error(t("post.error")); } finally { setLoading(false); }
  };

  const isAirbnb = form.cleaning_type === "airbnb";

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="gradient-primary px-4 pt-8 pb-6">
        <h1 className="text-xl font-bold text-primary-foreground">{t("post.title")}</h1>
        <p className="text-primary-foreground/70 text-sm">{t("post.subtitle")}</p>
      </div>

      <motion.form initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleSubmit} className="px-4 mt-4 space-y-4">
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

        {/* Property Photos */}
        <div className="bg-card rounded-2xl shadow-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            <p className="text-sm font-semibold text-foreground">{t("post.property_photos")}</p>
          </div>
          <p className="text-xs text-muted-foreground">{t("post.property_photos_hint")}</p>
          
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

        {/* Property Details */}
        <div className="bg-card rounded-2xl shadow-card p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">{t("post.property_details")}</p>
          <p className="text-xs text-muted-foreground">{t("post.property_details_hint")}</p>
          <Textarea
            placeholder={t("post.access_info_placeholder")}
            value={form.door_access_info}
            onChange={(e) => update("door_access_info", e.target.value)}
            className="rounded-xl min-h-[100px]"
          />
        </div>

        {/* Airbnb Details (conditional) */}
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
      <BottomNav />
    </div>
  );
}

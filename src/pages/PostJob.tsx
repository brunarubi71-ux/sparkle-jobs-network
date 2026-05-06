import { useEffect, useRef, useState } from "react";
import { containsContactInfo } from "@/lib/contactFilter";
import { lookupZip, detectZipCountry } from "@/lib/zipLookup";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import BottomNav from "@/components/BottomNav";
import IdentityVerificationModal from "@/components/IdentityVerificationModal";
import { JobStripeCheckout } from "@/components/JobStripeCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { toast } from "sonner";
import { PlusCircle, Camera, X, Upload, Star, ShieldAlert } from "lucide-react";
import { awardPoints } from "@/lib/points";
import { useLanguage } from "@/i18n/LanguageContext";

export default function PostJob() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editJobId = searchParams.get("edit");
  const isEditMode = !!editJobId;
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [editJobStatus, setEditJobStatus] = useState<string | null>(null);
  const isEditingDraft = isEditMode && editJobStatus === "draft";
  const [identityOpen, setIdentityOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [pendingJob, setPendingJob] = useState<{ id: string; amountCents: number; title: string } | null>(null);
  const walletBalance = Number((profile as any)?.wallet_balance || 0);
  const ownerIdentityStatus = (profile as any)?.identity_status || "unverified";
  // Block submission if not approved, but only show the banner for unverified/rejected (not pending — that lives on Profile)
  const ownerNeedsVerification = profile?.role === "owner" && ownerIdentityStatus !== "approved";
  const showOwnerVerifyBanner = profile?.role === "owner" && (ownerIdentityStatus === "unverified" || ownerIdentityStatus === "rejected");
  const [mainPhotoFile, setMainPhotoFile] = useState<File | null>(null);
  const [mainPhotoPreview, setMainPhotoPreview] = useState<string>("");
  const [existingMainPhoto, setExistingMainPhoto] = useState<string>("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [editLoading, setEditLoading] = useState(isEditMode);
  const DRAFT_KEY = "shinely_post_job_draft";
  const [form, setForm] = useState(() => {
    const defaults = {
      title: "", cleaning_type: "residential", price: "",
      bedrooms: "1", bathrooms: "1", address: "", city: "",
      zip_code: "", latitude: "", longitude: "",
      urgency: "scheduled", description: "", cleaners_required: "1", helpers_required: "0",
      door_code: "", supply_code: "", lockbox_code: "", gate_code: "",
      alarm_instructions: "", parking_instructions: "", door_access_info: "",
      guest_stay_length: "", number_of_guests: "",
    };
    if (isEditMode) return defaults;
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (saved) return { ...defaults, ...JSON.parse(saved) };
    } catch {}
    return defaults;
  });
  const [zipLookupLoading, setZipLookupLoading] = useState(false);
  const [zipLookupHint, setZipLookupHint] = useState<string | null>(null);

  // Load existing job in edit mode
  useEffect(() => {
    if (!isEditMode || !user || !editJobId) return;
    (async () => {
      const [jobRes, privRes] = await Promise.all([
        supabase
          .from("jobs")
          .select("*")
          .eq("id", editJobId)
          .eq("owner_id", user.id)
          .maybeSingle(),
        supabase
          .from("job_private_details" as any)
          .select("*")
          .eq("job_id", editJobId)
          .maybeSingle(),
      ]);
      const data = jobRes.data as any;
      const priv = (privRes.data as any) || {};
      if (jobRes.error || !data) {
        toast.error("Could not load job to edit.");
        navigate("/my-jobs");
        return;
      }
      setForm({
        title: data.title ?? "",
        cleaning_type: data.cleaning_type ?? "residential",
        price: data.price != null ? String(data.price) : "",
        bedrooms: data.bedrooms != null ? String(data.bedrooms) : "1",
        bathrooms: data.bathrooms != null ? String(data.bathrooms) : "1",
        address: data.address ?? "",
        city: data.city ?? "",
        zip_code: data.zip_code ?? "",
        latitude: data.latitude != null ? String(data.latitude) : "",
        longitude: data.longitude != null ? String(data.longitude) : "",
        urgency: data.urgency ?? "scheduled",
        description: data.description ?? "",
        cleaners_required: data.cleaners_required != null ? String(data.cleaners_required) : "1",
        helpers_required: data.helpers_required != null ? String(data.helpers_required) : "0",
        door_code: priv.door_code ?? "",
        supply_code: priv.supply_code ?? "",
        lockbox_code: priv.lockbox_code ?? "",
        gate_code: priv.gate_code ?? "",
        alarm_instructions: priv.alarm_instructions ?? "",
        parking_instructions: priv.parking_instructions ?? "",
        door_access_info: priv.door_access_info ?? "",
        guest_stay_length: data.guest_stay_length != null ? String(data.guest_stay_length) : "",
        number_of_guests: data.number_of_guests != null ? String(data.number_of_guests) : "",
      });
      setExistingMainPhoto(data.main_property_photo ?? "");
      setExistingPhotos(Array.isArray(data.property_photos) ? data.property_photos : []);
      setEditJobStatus(data.status ?? null);
      setEditLoading(false);
    })();
  }, [isEditMode, editJobId, user, navigate]);

  // Persist draft to sessionStorage (skip in edit mode)
  useEffect(() => {
    if (isEditMode) return;
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form)); } catch {}
  }, [form, isEditMode]);

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const handleZipBlur = async () => {
    const raw = form.zip_code.trim();
    if (!raw) {
      setZipLookupHint(null);
      return;
    }
    const country = detectZipCountry(raw);
    if (!country) {
      setZipLookupHint(t("post.zip_invalid") || "Enter a 5-digit ZIP (US) or 8-digit CEP (BR).");
      return;
    }
    setZipLookupLoading(true);
    setZipLookupHint(null);
    try {
      const result = await lookupZip(raw);
      if (!result) {
        setZipLookupHint(t("post.zip_not_found") || "Postal code not found.");
        return;
      }
      setForm((f) => ({
        ...f,
        zip_code: result.zip,
        // Only auto-fill the city/address when they're still empty so we
        // don't overwrite something the user already typed by hand.
        city: f.city || `${result.city}${result.state ? `, ${result.state}` : ""}`,
        address: f.address || result.street || "",
        latitude: result.latitude != null ? String(result.latitude) : f.latitude,
        longitude: result.longitude != null ? String(result.longitude) : f.longitude,
      }));
      const placeLabel = `${result.city}${result.state ? ", " + result.state : ""}`;
      setZipLookupHint(`📍 ${placeLabel}`);
    } catch (err) {
      console.error("[PostJob] zip lookup failed:", err);
      setZipLookupHint(t("post.zip_lookup_failed") || "Could not look up postal code. Please type the address manually.");
    } finally {
      setZipLookupLoading(false);
    }
  };

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

  const handleSubmit = (e: React.FormEvent) => {
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
    if (!mainPhotoFile && !existingMainPhoto) {
      toast.error(t("post.main_photo_required"));
      return;
    }
    const priceNum = parseFloat(form.price) || 0;
    if (priceNum <= 0) {
      toast.error(t("post.price"));
      return;
    }
    const totalWorkers = (parseInt(form.cleaners_required) || 0) + (parseInt(form.helpers_required) || 0);
    if (totalWorkers < 1) {
      toast.error("Please request at least 1 Cleaner or Helper.");
      return;
    }
    if (isEditMode) {
      saveEdits();
      return;
    }
    setConfirmOpen(true);
  };

  const saveEdits = async () => {
    if (!user || !editJobId) return;
    setLoading(true);
    setUploadingPhotos(true);
    try {
      const price = parseFloat(form.price) || 0;
      const platformFee = Math.round(price * 0.1 * 100) / 100;
      const cleanerEarnings = price;
      const totalCharged = Math.round((price + platformFee) * 100) / 100;

      let mainPhotoUrl = existingMainPhoto;
      if (mainPhotoFile) mainPhotoUrl = await uploadFile(mainPhotoFile, "main");
      const newAdditional: string[] = [];
      for (const f of photoFiles) newAdditional.push(await uploadFile(f, "additional"));
      const allAdditional = [...existingPhotos, ...newAdditional];
      setUploadingPhotos(false);

      const cleanersReq = parseInt(form.cleaners_required) || 0;
      const helpersReq = parseInt(form.helpers_required) || 0;
      const teamSize = cleanersReq + helpersReq;

      const { error } = await supabase.from("jobs").update({
        title: form.title, cleaning_type: form.cleaning_type, price,
        bedrooms: parseInt(form.bedrooms), bathrooms: parseInt(form.bathrooms),
        address: form.address || null, city: form.city || null,
        zip_code: form.zip_code || null,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        urgency: form.urgency,
        description: form.description || null, total_amount: totalCharged,
        platform_fee: platformFee, cleaner_earnings: cleanerEarnings,
        team_size_required: Math.max(1, teamSize),
        cleaners_required: cleanersReq, helpers_required: helpersReq,
        main_property_photo: mainPhotoUrl,
        property_photos: allAdditional.length > 0 ? allAdditional : null,
        number_of_guests: form.number_of_guests ? parseInt(form.number_of_guests) : null,
        guest_stay_length: form.guest_stay_length ? parseInt(form.guest_stay_length) : null,
      } as any).eq("id", editJobId).eq("owner_id", user.id);
      if (error) throw error;

      const { error: privError } = await supabase
        .from("job_private_details" as any)
        .upsert({
          job_id: editJobId,
          door_code: form.door_code || null,
          supply_code: form.supply_code || null,
          lockbox_code: form.lockbox_code || null,
          gate_code: form.gate_code || null,
          alarm_instructions: form.alarm_instructions || null,
          parking_instructions: form.parking_instructions || null,
          door_access_info: form.door_access_info || null,
        }, { onConflict: "job_id" });
      if (privError) throw privError;
      toast.success("Job updated");
      navigate("/my-jobs");
    } catch (err) {
      console.error("[PostJob] saveEdits error:", err);
      toast.error(t("post.error"));
    } finally {
      setLoading(false);
      setUploadingPhotos(false);
    }
  };

  const submittingRef = useRef(false);

  const submitJob = async (paymentMethod: "card" | "wallet") => {
    if (!user || !mainPhotoFile) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    setConfirmOpen(false);
    setLoading(true);
    setUploadingPhotos(true);
    try {
      // Model B: Owner types what cleaner receives, platform adds 10% on top
      const price = parseFloat(form.price) || 0;
      const platformFee = Math.round(price * 0.1 * 100) / 100;
      const cleanerEarnings = price;
      const totalCharged = Math.round((price + platformFee) * 100) / 100;

      const mainPhotoUrl = await uploadFile(mainPhotoFile, "main");
      const additionalUrls: string[] = [];
      for (const file of photoFiles) {
        additionalUrls.push(await uploadFile(file, "additional"));
      }
      setUploadingPhotos(false);

      // Card → create as pending_payment until Stripe confirms; Wallet → open immediately.
      const status = paymentMethod === "card" ? "pending_payment" : "open";

      const cleanersReq = parseInt(form.cleaners_required) || 0;
      const helpersReq = parseInt(form.helpers_required) || 0;
      const teamSize = cleanersReq + helpersReq;

      const { data: insertedJob, error } = await supabase.from("jobs").insert({
        owner_id: user.id, title: form.title, cleaning_type: form.cleaning_type,
        price, bedrooms: parseInt(form.bedrooms), bathrooms: parseInt(form.bathrooms),
        address: form.address || null, city: form.city || null,
        zip_code: form.zip_code || null,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        urgency: form.urgency,
        description: form.description || null, total_amount: totalCharged,
        platform_fee: platformFee, cleaner_earnings: cleanerEarnings,
        team_size_required: Math.max(1, teamSize),
        cleaners_required: cleanersReq,
        helpers_required: helpersReq,
        main_property_photo: mainPhotoUrl,
        property_photos: additionalUrls.length > 0 ? additionalUrls : null,
        status,
        number_of_guests: form.number_of_guests ? parseInt(form.number_of_guests) : null,
        guest_stay_length: form.guest_stay_length ? parseInt(form.guest_stay_length) : null,
      } as any).select("id").single();
      if (error) throw error;

      const hasPrivateData =
        form.door_code || form.supply_code || form.lockbox_code || form.gate_code ||
        form.alarm_instructions || form.parking_instructions || form.door_access_info;
      if (hasPrivateData && insertedJob?.id) {
        const { error: privError } = await supabase
          .from("job_private_details" as any)
          .insert({
            job_id: insertedJob.id,
            door_code: form.door_code || null,
            supply_code: form.supply_code || null,
            lockbox_code: form.lockbox_code || null,
            gate_code: form.gate_code || null,
            alarm_instructions: form.alarm_instructions || null,
            parking_instructions: form.parking_instructions || null,
            door_access_info: form.door_access_info || null,
          });
        if (privError) {
          await supabase.from("jobs").delete().eq("id", insertedJob.id);
          throw privError;
        }
      }

      if (paymentMethod === "wallet") {
        // Atomic debit (handles concurrent updates and insufficient funds in one statement)
        const { error: debitError } = await supabase.rpc("debit_wallet", {
          p_user_id: user!.id,
          p_amount: totalCharged,
          p_description: `Job posted: ${form.title}`,
          p_job_id: insertedJob?.id || null,
        });
        if (debitError) {
          // Roll the unpaid job back so the owner isn't left with a stuck "open" job
          await supabase.from("jobs").delete().eq("id", insertedJob!.id);
          toast.error(debitError.message || "Wallet payment failed");
          return;
        }
        await refreshProfile();
        sessionStorage.removeItem(DRAFT_KEY);
        toast.success("Job posted successfully! 🎉");
        try { await awardPoints(user.id, "job_posted"); } catch {}
        navigate("/my-jobs");
        return;
      }

      // Card path → open Stripe Embedded Checkout
      setPendingJob({
        id: insertedJob!.id,
        amountCents: Math.round(totalCharged * 100),
        title: form.title,
      });
      sessionStorage.removeItem(DRAFT_KEY);
      setCheckoutOpen(true);
      try { await awardPoints(user.id, "job_posted"); } catch {}
    } catch (err: any) {
      console.error("PostJob submit failed:", err);
      toast.error(err?.message || t("post.error"));
    } finally {
      setLoading(false);
      setUploadingPhotos(false);
      submittingRef.current = false;
    }
  };

  const handlePayCard = () => {
    if (submittingRef.current) return;
    submitJob("card");
  };

  const handlePayWallet = () => {
    if (submittingRef.current) return;
    const price = parseFloat(form.price) || 0;
    const fee = Math.round(price * 0.1 * 100) / 100;
    const total = Math.round((price + fee) * 100) / 100;
    if (walletBalance < total) {
      toast.error("Insufficient wallet balance. Add funds or pay with card.");
      return;
    }
    submitJob("wallet");
  };

  const isAirbnb = form.cleaning_type === "airbnb";

  return (
    <div className="min-h-screen bg-background pb-20">
      <PaymentTestModeBanner />
      <div className="gradient-primary px-4 pt-8 pb-6">
        <h1 className="text-xl font-bold text-primary-foreground">{isEditMode ? "Edit job" : t("post.title")}</h1>
        <p className="text-primary-foreground/70 text-sm">{isEditMode ? "Update your job details" : t("post.subtitle")}</p>
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
                <SelectItem value="asap">{t("post.asap")}</SelectItem>
                <SelectItem value="urgent">{t("post.urgent")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input placeholder={t("post.price")} type="number" value={form.price} onChange={(e) => update("price", e.target.value)} required className="rounded-xl h-12" />
          {form.price && parseFloat(form.price) > 0 && (() => {
            const p = parseFloat(form.price);
            const fee = p * 0.1;
            const total = p + fee;
            return (
              <div className="bg-accent rounded-xl p-3 text-xs space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Cleaner receives</span><span className="font-bold text-primary">${p.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Platform fee (10%)</span><span className="text-foreground">+${fee.toFixed(2)}</span></div>
                <div className="flex justify-between border-t border-border pt-1"><span className="font-semibold text-foreground">Total you pay</span><span className="font-bold text-foreground">${total.toFixed(2)}</span></div>
              </div>
            );
          })()}
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
          <div className="space-y-1">
            <div className="flex gap-2">
              <Input
                placeholder={t("post.zip_code") || "ZIP / CEP"}
                value={form.zip_code}
                onChange={(e) => update("zip_code", e.target.value)}
                onBlur={handleZipBlur}
                inputMode="numeric"
                autoComplete="postal-code"
                className="rounded-xl h-12 flex-1"
              />
              {zipLookupLoading && (
                <div className="flex items-center text-xs text-muted-foreground px-2">
                  {t("post.zip_looking_up") || "Looking up…"}
                </div>
              )}
            </div>
            {zipLookupHint && (
              <p className="text-xs text-muted-foreground px-1">{zipLookupHint}</p>
            )}
          </div>
          <Input placeholder={t("post.address")} value={form.address} onChange={(e) => update("address", e.target.value)} className="rounded-xl h-12" />
          <Input placeholder={t("post.city")} value={form.city} onChange={(e) => update("city", e.target.value)} className="rounded-xl h-12" />
          <Textarea placeholder={t("post.description")} value={form.description} onChange={(e) => update("description", e.target.value)} className="rounded-xl min-h-[80px]" autoCorrect="off" autoCapitalize="sentences" spellCheck={false} />
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-foreground mb-2">🚗 Cleaners needed (with car)</p>
              <Select value={form.cleaners_required} onValueChange={(v) => update("cleaners_required", v)}>
                <SelectTrigger className="rounded-xl h-12"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0</SelectItem>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-2">🤝 Helpers needed (no car)</p>
              <Select value={form.helpers_required} onValueChange={(v) => update("helpers_required", v)}>
                <SelectTrigger className="rounded-xl h-12"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0</SelectItem>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(parseInt(form.cleaners_required) || 0) + (parseInt(form.helpers_required) || 0) === 0 && (
              <p className="text-xs text-destructive">At least 1 worker (Cleaner or Helper) is required.</p>
            )}
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
          ) : existingMainPhoto ? (
            <div className="space-y-2">
              <div className="relative aspect-video rounded-xl overflow-hidden border border-border">
                <img src={existingMainPhoto} alt="" className="w-full h-full object-cover" />
              </div>
              <label className="flex items-center justify-center gap-2 border-2 border-dashed border-primary/30 rounded-xl p-3 cursor-pointer hover:border-primary/50 transition-colors bg-primary/5">
                <Camera className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium text-primary">Replace main photo</span>
                <input type="file" accept="image/*" onChange={handleMainPhotoSelect} className="hidden" />
              </label>
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

          {(existingPhotos.length > 0 || photoPreviews.length > 0) && (
            <div className="grid grid-cols-3 gap-2">
              {existingPhotos.map((src, i) => (
                <div key={`existing-${i}`} className="relative aspect-square rounded-xl overflow-hidden border border-border">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setExistingPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {photoPreviews.map((src, i) => (
                <div key={`new-${i}`} className="relative aspect-square rounded-xl overflow-hidden border border-border">
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
            <Textarea placeholder={t("post.alarm_placeholder")} value={form.alarm_instructions} onChange={(e) => update("alarm_instructions", e.target.value)} className="rounded-xl min-h-[60px]" autoCorrect="off" autoCapitalize="sentences" spellCheck={false} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("post.parking_instructions")}</Label>
            <Textarea placeholder={t("post.parking_placeholder")} value={form.parking_instructions} onChange={(e) => update("parking_instructions", e.target.value)} className="rounded-xl min-h-[60px]" autoCorrect="off" autoCapitalize="sentences" spellCheck={false} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("post.additional_notes")}</Label>
            <Textarea placeholder={t("post.additional_notes_placeholder")} value={form.door_access_info} onChange={(e) => update("door_access_info", e.target.value)} className="rounded-xl min-h-[60px]" autoCorrect="off" autoCapitalize="sentences" spellCheck={false} />
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

        <Button type="submit" disabled={loading || uploadingPhotos || editLoading} className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold hover:opacity-90">
          <PlusCircle className="w-4 h-4 mr-2" />
          {uploadingPhotos
            ? t("post.uploading_photos")
            : loading
              ? (isEditMode ? "Saving..." : t("post.posting"))
              : (isEditMode ? "Save changes" : t("post.submit"))}
        </Button>
      </motion.form>
      <IdentityVerificationModal open={identityOpen} onOpenChange={setIdentityOpen} />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Confirm payment</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Review your job details before posting.
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const priceNum = parseFloat(form.price) || 0;
            const fee = Math.round(priceNum * 0.1 * 100) / 100;
            const total = Math.round((priceNum + fee) * 100) / 100;
            return (
              <div className="space-y-4">
                <div className="bg-accent rounded-xl p-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Job</span>
                    <span className="font-medium text-foreground text-right truncate max-w-[60%]">{form.title || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cleaner receives</span>
                    <span className="font-semibold text-primary">${priceNum.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Platform fee (10%)</span>
                    <span className="text-foreground">+${fee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2">
                    <span className="font-semibold text-foreground">Total you pay</span>
                    <span className="font-bold text-foreground">${total.toFixed(2)}</span>
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={handlePayCard}
                  disabled={loading || uploadingPhotos}
                  className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold hover:opacity-90"
                >
                  Pay with Card — ${total.toFixed(2)}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePayWallet}
                  disabled={loading || uploadingPhotos}
                  className="w-full h-12 rounded-xl font-semibold"
                >
                  Pay with Wallet (${walletBalance.toFixed(2)})
                </Button>
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog
        open={checkoutOpen}
        modal={false}
        onOpenChange={(open) => { if (!open) { setCheckoutOpen(false); setPendingJob(null); } }}
      >
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          className="rounded-2xl max-w-md max-h-[90vh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle className="text-foreground">Complete payment</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Pay securely with Stripe to publish your job.
            </DialogDescription>
          </DialogHeader>
          {pendingJob && (
            <JobStripeCheckout
              amountInCents={pendingJob.amountCents}
              jobId={pendingJob.id}
              jobTitle={pendingJob.title}
              customerEmail={profile?.email || undefined}
              userId={user?.id}
              returnUrl={`${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}&job_id=${pendingJob.id}`}
            />
          )}
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}

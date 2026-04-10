import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BottomNav from "@/components/BottomNav";
import { toast } from "sonner";
import { PlusCircle } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

export default function PostJob() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "", cleaning_type: "residential", price: "",
    bedrooms: "1", bathrooms: "1", address: "", city: "",
    urgency: "scheduled", description: "", team_size: "1",
  });

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const price = parseFloat(form.price) || 0;
      const platformFee = Math.round(price * 0.1 * 100) / 100;
      const cleanerEarnings = Math.round((price - platformFee) * 100) / 100;
      const { error } = await supabase.from("jobs").insert({
        owner_id: user.id, title: form.title, cleaning_type: form.cleaning_type,
        price, bedrooms: parseInt(form.bedrooms), bathrooms: parseInt(form.bathrooms),
        address: form.address || null, city: form.city || null, urgency: form.urgency,
        description: form.description || null, total_amount: price,
        platform_fee: platformFee, cleaner_earnings: cleanerEarnings,
        team_size_required: parseInt(form.team_size) || 1,
      });
      if (error) throw error;
      toast.success(t("post.success"));
      navigate("/my-jobs");
    } catch { toast.error(t("post.error")); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="gradient-primary px-4 pt-8 pb-6">
        <h1 className="text-xl font-bold text-primary-foreground">{t("post.title")}</h1>
        <p className="text-primary-foreground/70 text-sm">{t("post.subtitle")}</p>
      </div>

      <motion.form initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleSubmit} className="px-4 mt-4 space-y-4">
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
            <Input placeholder={t("post.bedrooms")} type="number" value={form.bedrooms} onChange={(e) => update("bedrooms", e.target.value)} className="rounded-xl h-12" />
            <Input placeholder={t("post.bathrooms")} type="number" value={form.bathrooms} onChange={(e) => update("bathrooms", e.target.value)} className="rounded-xl h-12" />
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
        <Button type="submit" disabled={loading} className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold hover:opacity-90">
          <PlusCircle className="w-4 h-4 mr-2" />
          {loading ? t("post.posting") : t("post.submit")}
        </Button>
      </motion.form>
      <BottomNav />
    </div>
  );
}

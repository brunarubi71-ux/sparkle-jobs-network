import { useState } from "react";
import { containsContactInfo } from "@/lib/contactFilter";
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
import { ShoppingBag } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

export default function SellSchedule() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    city: "", number_of_houses: "1", frequency: "weekly",
    monthly_income_estimate: "", asking_price: "", description: "",
    contact_name: "", phone: "", email: "",
  });

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (containsContactInfo(form.description)) {
      toast.error(t("security.contact_blocked"));
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from("schedules").insert({
        owner_id: user.id, city: form.city,
        number_of_houses: parseInt(form.number_of_houses), frequency: form.frequency,
        monthly_income_estimate: form.monthly_income_estimate ? parseFloat(form.monthly_income_estimate) : null,
        asking_price: form.asking_price ? parseFloat(form.asking_price) : null,
        description: form.description || null, contact_name: form.contact_name || null,
        phone: form.phone || null, email: form.email || null,
      });
      if (error) throw error;
      toast.success(t("sell.success"));
      navigate("/my-jobs");
    } catch { toast.error(t("sell.error")); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="gradient-primary px-4 pt-8 pb-6">
        <h1 className="text-xl font-bold text-primary-foreground">{t("sell.title")}</h1>
        <p className="text-primary-foreground/70 text-sm">{t("sell.subtitle")}</p>
      </div>
      <motion.form initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleSubmit} className="px-4 mt-4 space-y-4">
        <div className="bg-card rounded-2xl shadow-card p-4 space-y-4">
          <Input placeholder={t("sell.city")} value={form.city} onChange={(e) => update("city", e.target.value)} required className="rounded-xl h-12" />
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder={t("sell.houses")} type="number" value={form.number_of_houses} onChange={(e) => update("number_of_houses", e.target.value)} className="rounded-xl h-12" />
            <Select value={form.frequency} onValueChange={(v) => update("frequency", v)}>
              <SelectTrigger className="rounded-xl h-12"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">{t("sell.weekly")}</SelectItem>
                <SelectItem value="bi-weekly">{t("sell.biweekly")}</SelectItem>
                <SelectItem value="monthly">{t("sell.monthly")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder={t("sell.monthly_income")} type="number" value={form.monthly_income_estimate} onChange={(e) => update("monthly_income_estimate", e.target.value)} className="rounded-xl h-12" />
            <Input placeholder={t("sell.asking_price")} type="number" value={form.asking_price} onChange={(e) => update("asking_price", e.target.value)} className="rounded-xl h-12" />
          </div>
          <Textarea placeholder={t("sell.description")} value={form.description} onChange={(e) => update("description", e.target.value)} className="rounded-xl min-h-[80px]" />
          <Input placeholder={t("sell.contact_name")} value={form.contact_name} onChange={(e) => update("contact_name", e.target.value)} className="rounded-xl h-12" />
        </div>
        <Button type="submit" disabled={loading} className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold hover:opacity-90">
          <ShoppingBag className="w-4 h-4 mr-2" />
          {loading ? t("sell.listing") : t("sell.list_sale")}
        </Button>
      </motion.form>
      <BottomNav />
    </div>
  );
}

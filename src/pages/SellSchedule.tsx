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
import { ShoppingBag } from "lucide-react";

export default function SellSchedule() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    city: "",
    number_of_houses: "1",
    frequency: "weekly",
    monthly_income_estimate: "",
    asking_price: "",
    description: "",
    contact_name: "",
    phone: "",
    email: "",
  });

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("schedules").insert({
        owner_id: user.id,
        city: form.city,
        number_of_houses: parseInt(form.number_of_houses),
        frequency: form.frequency,
        monthly_income_estimate: form.monthly_income_estimate ? parseFloat(form.monthly_income_estimate) : null,
        asking_price: form.asking_price ? parseFloat(form.asking_price) : null,
        description: form.description || null,
        contact_name: form.contact_name || null,
        phone: form.phone || null,
        email: form.email || null,
      });
      if (error) throw error;
      toast.success("Schedule listed for sale!");
      navigate("/my-jobs");
    } catch {
      toast.error("Failed to list schedule");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="gradient-primary px-4 pt-8 pb-6">
        <h1 className="text-xl font-bold text-primary-foreground">Sell a Schedule</h1>
        <p className="text-primary-foreground/70 text-sm">List your cleaning route for sale</p>
      </div>

      <motion.form initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleSubmit} className="px-4 mt-4 space-y-4">
        <div className="bg-card rounded-2xl shadow-card p-4 space-y-4">
          <Input placeholder="City *" value={form.city} onChange={(e) => update("city", e.target.value)} required className="rounded-xl h-12" />
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="# of Houses" type="number" value={form.number_of_houses} onChange={(e) => update("number_of_houses", e.target.value)} className="rounded-xl h-12" />
            <Select value={form.frequency} onValueChange={(v) => update("frequency", v)}>
              <SelectTrigger className="rounded-xl h-12"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="bi-weekly">Bi-Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Monthly Income ($)" type="number" value={form.monthly_income_estimate} onChange={(e) => update("monthly_income_estimate", e.target.value)} className="rounded-xl h-12" />
            <Input placeholder="Asking Price ($)" type="number" value={form.asking_price} onChange={(e) => update("asking_price", e.target.value)} className="rounded-xl h-12" />
          </div>
          <Textarea placeholder="Description" value={form.description} onChange={(e) => update("description", e.target.value)} className="rounded-xl min-h-[80px]" />

          <Input placeholder="Contact Name" value={form.contact_name} onChange={(e) => update("contact_name", e.target.value)} className="rounded-xl h-12" />
        </div>

        <Button type="submit" disabled={loading} className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold hover:opacity-90">
          <ShoppingBag className="w-4 h-4 mr-2" />
          {loading ? "Listing..." : "List for Sale"}
        </Button>
      </motion.form>

      <BottomNav />
    </div>
  );
}

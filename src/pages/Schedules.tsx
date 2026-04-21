import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, Home, Clock, DollarSign, Lock, Phone, Mail, User, Pencil, Trash2, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ShimmerCard from "@/components/ShimmerCard";
import EmptyState from "@/components/EmptyState";
import PremiumModal from "@/components/PremiumModal";
import BottomNav from "@/components/BottomNav";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

interface Schedule {
  id: string;
  owner_id: string;
  city: string;
  number_of_houses: number;
  frequency: string;
  monthly_income_estimate: number | null;
  asking_price: number | null;
  description: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
}

export default function Schedules() {
  const { user, profile, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [showPaywall, setShowPaywall] = useState(false);

  const [editing, setEditing] = useState<Schedule | null>(null);
  const [editForm, setEditForm] = useState({
    city: "",
    number_of_houses: "1",
    frequency: "weekly",
    monthly_income_estimate: "",
    asking_price: "",
    description: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("schedules")
      .select("*")
      .order("created_at", { ascending: false });
    setSchedules((data as Schedule[]) || []);
    setLoading(false);
  };

  const myListings = schedules.filter((s) => s.owner_id === user?.id);
  const browseListings = schedules.filter((s) => s.owner_id !== user?.id);

  const isOwner = profile?.role === "owner";
  const ownerUnlocked = !!(profile as any)?.schedules_unlocked;

  const getContactLimit = () => {
    const tier = profile?.plan_tier || "free";
    if (tier === "premium") return Infinity;
    if (tier === "pro") return 1;
    return 0;
  };

  const canUnlockContact = () => {
    if (!profile) return false;
    const limit = getContactLimit();
    if (limit === Infinity) return true;
    return profile.free_contacts_used < limit;
  };

  const handleOwnerUnlockClick = () => {
    toast.info("Payment coming soon! You'll be notified when this feature is live.");
  };

  const unlockContact = async (scheduleId: string) => {
    if (!user || !profile) return;
    const limit = getContactLimit();
    if (limit === Infinity || unlockedIds.has(scheduleId)) {
      setUnlockedIds((s) => new Set(s).add(scheduleId));
      return;
    }
    if (!canUnlockContact()) {
      setShowPaywall(true);
      return;
    }
    await supabase
      .from("profiles")
      .update({ free_contacts_used: profile.free_contacts_used + 1 })
      .eq("id", user.id);
    setUnlockedIds((s) => new Set(s).add(scheduleId));
    await refreshProfile();
  };

  const isUnlocked = (id: string) => {
    if (isOwner) return ownerUnlocked;
    return profile?.plan_tier === "premium" || unlockedIds.has(id);
  };

  const openEdit = (s: Schedule) => {
    setEditing(s);
    setEditForm({
      city: s.city,
      number_of_houses: String(s.number_of_houses),
      frequency: s.frequency,
      monthly_income_estimate: s.monthly_income_estimate?.toString() || "",
      asking_price: s.asking_price?.toString() || "",
      description: s.description || "",
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    const { error } = await supabase
      .from("schedules")
      .update({
        city: editForm.city,
        number_of_houses: parseInt(editForm.number_of_houses) || 1,
        frequency: editForm.frequency,
        monthly_income_estimate: editForm.monthly_income_estimate
          ? parseFloat(editForm.monthly_income_estimate)
          : null,
        asking_price: editForm.asking_price ? parseFloat(editForm.asking_price) : null,
        description: editForm.description || null,
      })
      .eq("id", editing.id);
    setSavingEdit(false);
    if (error) {
      toast.error("Failed to update listing");
      return;
    }
    toast.success("Listing updated");
    setEditing(null);
    fetchSchedules();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("schedules").delete().eq("id", deleteId);
    if (error) {
      toast.error("Failed to delete listing");
      setDeleteId(null);
      return;
    }
    toast.success("Listing deleted");
    setDeleteId(null);
    setSchedules((prev) => prev.filter((s) => s.id !== deleteId));
  };

  const renderBrowseCard = (s: Schedule, i: number) => (
    <motion.div
      key={s.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.05 }}
      className="bg-card rounded-2xl p-4 shadow-card"
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
            <MapPin className="w-3.5 h-3.5" /> {s.city}
          </div>
          <p className="text-lg font-bold text-foreground">
            {s.asking_price ? `$${s.asking_price}` : t("schedules.contact_price")}
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Home className="w-3 h-3" /> {s.number_of_houses} {t("schedules.houses")}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
            <Clock className="w-3 h-3" /> {s.frequency}
          </div>
        </div>
      </div>
      {s.monthly_income_estimate && (
        <div className="flex items-center gap-1 text-sm text-primary font-medium mb-2">
          <DollarSign className="w-3.5 h-3.5" /> ${s.monthly_income_estimate}
          {t("schedules.income")}
        </div>
      )}
      {s.description && (
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{s.description}</p>
      )}
      {isUnlocked(s.id) ? (
        <div className="bg-accent rounded-xl p-3 space-y-1">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <User className="w-3.5 h-3.5 text-primary" /> {s.contact_name}
          </div>
          {s.phone && (
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Phone className="w-3.5 h-3.5 text-primary" /> {s.phone}
            </div>
          )}
          {s.email && (
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Mail className="w-3.5 h-3.5 text-primary" /> {s.email}
            </div>
          )}
        </div>
      ) : isOwner ? (
        <div className="relative bg-accent rounded-xl p-3 space-y-1 overflow-hidden">
          <div className="space-y-1 blur-sm select-none pointer-events-none">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <User className="w-3.5 h-3.5 text-primary" /> ████████████
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Phone className="w-3.5 h-3.5 text-primary" /> ███████████
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Mail className="w-3.5 h-3.5 text-primary" /> ██████████████
            </div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-background/40">
            <div className="bg-card/90 rounded-full p-2 shadow-card">
              <Lock className="w-5 h-5 text-primary" />
            </div>
          </div>
        </div>
      ) : (
        <Button
          onClick={() => unlockContact(s.id)}
          variant="outline"
          className="w-full h-10 rounded-xl border-primary text-primary font-medium hover:bg-accent"
        >
          <Lock className="w-4 h-4 mr-2" />
          {canUnlockContact() ? t("schedules.unlock_contact") : t("schedules.unlock_premium")}
        </Button>
      )}
    </motion.div>
  );

  const renderMyListingCard = (s: Schedule, i: number) => (
    <motion.div
      key={s.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.05 }}
      className="bg-card rounded-2xl p-4 shadow-card"
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
            <MapPin className="w-3.5 h-3.5" /> {s.city}
          </div>
          <p className="text-lg font-bold text-foreground">
            {s.asking_price ? `$${s.asking_price}` : t("schedules.contact_price")}
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Home className="w-3 h-3" /> {s.number_of_houses} {t("schedules.houses")}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
            <Clock className="w-3 h-3" /> {s.frequency}
          </div>
        </div>
      </div>
      {s.monthly_income_estimate && (
        <div className="flex items-center gap-1 text-sm text-primary font-medium mb-2">
          <DollarSign className="w-3.5 h-3.5" /> ${s.monthly_income_estimate}
          {t("schedules.income")}
        </div>
      )}
      {s.description && (
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{s.description}</p>
      )}
      <div className="flex gap-2">
        <Button
          onClick={() => openEdit(s)}
          variant="outline"
          className="flex-1 h-10 rounded-xl border-primary text-primary font-medium hover:bg-accent"
        >
          <Pencil className="w-4 h-4 mr-2" />
          Edit
        </Button>
        <Button
          onClick={() => setDeleteId(s.id)}
          variant="outline"
          className="flex-1 h-10 rounded-xl border-destructive text-destructive font-medium hover:bg-destructive/10"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </Button>
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-4 pt-6 pb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("schedules.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("schedules.subtitle")}</p>
        </div>
        {isOwner && (
          <Button
            onClick={() => navigate("/sell-schedule")}
            className="rounded-xl gradient-primary text-primary-foreground font-semibold hover:opacity-90 shrink-0"
          >
            <Plus className="w-4 h-4 mr-1" />
            New Listing
          </Button>
        )}
      </div>

      <Tabs defaultValue="browse" className="px-4">
        <TabsList className="grid grid-cols-2 w-full rounded-xl bg-accent">
          <TabsTrigger value="browse" className="rounded-xl">Browse</TabsTrigger>
          <TabsTrigger value="mine" className="rounded-xl">My Listings</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-3 mt-4">
          {isOwner && !ownerUnlocked && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl p-4 gradient-primary text-primary-foreground shadow-card"
            >
              <div className="flex items-start gap-3">
                <div className="bg-primary-foreground/20 rounded-full p-2 shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm mb-1">
                    Unlock all schedules for a one-time $2.99 payment
                  </p>
                  <p className="text-xs opacity-90 mb-3">
                    Get full contact details for every listing — forever.
                  </p>
                  <Button
                    onClick={handleOwnerUnlockClick}
                    className="h-9 rounded-xl bg-primary-foreground text-primary font-semibold hover:bg-primary-foreground/90"
                  >
                    <Lock className="w-3.5 h-3.5 mr-2" />
                    Unlock Now — $2.99
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <ShimmerCard key={i} />)
          ) : browseListings.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">{t("schedules.no_schedules")}</p>
            </div>
          ) : (
            browseListings.map((s, i) => renderBrowseCard(s, i))
          )}
        </TabsContent>

        <TabsContent value="mine" className="space-y-3 mt-4">
          {loading ? (
            Array.from({ length: 2 }).map((_, i) => <ShimmerCard key={i} />)
          ) : myListings.length === 0 ? (
            <div className="text-center py-12 px-4">
              <p className="text-muted-foreground mb-4">
                You haven't listed any schedules yet. Create your first listing!
              </p>
              <Button
                onClick={() => navigate("/sell-schedule")}
                className="rounded-xl gradient-primary text-primary-foreground font-semibold hover:opacity-90"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Listing
              </Button>
            </div>
          ) : (
            myListings.map((s, i) => renderMyListingCard(s, i))
          )}
        </TabsContent>
      </Tabs>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Listing</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="City"
              value={editForm.city}
              onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
              className="rounded-xl h-12"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Houses"
                type="number"
                value={editForm.number_of_houses}
                onChange={(e) => setEditForm({ ...editForm, number_of_houses: e.target.value })}
                className="rounded-xl h-12"
              />
              <Select
                value={editForm.frequency}
                onValueChange={(v) => setEditForm({ ...editForm, frequency: v })}
              >
                <SelectTrigger className="rounded-xl h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Monthly income"
                type="number"
                value={editForm.monthly_income_estimate}
                onChange={(e) =>
                  setEditForm({ ...editForm, monthly_income_estimate: e.target.value })
                }
                className="rounded-xl h-12"
              />
              <Input
                placeholder="Asking price"
                type="number"
                value={editForm.asking_price}
                onChange={(e) => setEditForm({ ...editForm, asking_price: e.target.value })}
                className="rounded-xl h-12"
              />
            </div>
            <Textarea
              placeholder="Description"
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              className="rounded-xl min-h-[80px]"
            />
          </div>
          <DialogFooter className="flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setEditing(null)}
              className="flex-1 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={saveEdit}
              disabled={savingEdit}
              className="flex-1 rounded-xl gradient-primary text-primary-foreground hover:opacity-90"
            >
              {savingEdit ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this listing?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Your listing will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PremiumModal
        open={showPaywall}
        onClose={() => setShowPaywall(false)}
        title={t("premium.contact_limit")}
        message={t("premium.contact_limit_msg")}
      />
      <BottomNav />
    </div>
  );
}

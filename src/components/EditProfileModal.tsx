import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { awardPoints } from "@/lib/points";
import { Check } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const WORKER_SPECIALTIES = [
  "Residential", "Airbnb", "Commercial", "Deep Clean",
  "Move-in/out", "Office", "Post-construction",
];
const LANGUAGES = ["English", "Spanish", "Portuguese", "French", "Other"];
const OWNER_PROPERTY_TYPES = ["Residential", "Airbnb", "Commercial", "Mixed"];
const OWNER_LANGS = ["English", "Spanish", "Portuguese"];

function Chip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background text-muted-foreground border-border hover:border-primary/40"
      }`}
    >
      {active && <Check className="inline w-3 h-3 mr-1 -mt-0.5" />}
      {children}
    </button>
  );
}

export default function EditProfileModal({ open, onOpenChange }: Props) {
  const { user, profile, refreshProfile } = useAuth();
  const isOwner = profile?.role === "owner";

  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [years, setYears] = useState<number>(0);
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  const [preferredLang, setPreferredLang] = useState("English");

  useEffect(() => {
    if (!profile) return;
    const p: any = profile;
    setFullName(p.full_name || "");
    setBio(p.bio || "");
    setSpecialties(p.specialties || []);
    setLanguages(p.languages || []);
    setYears(p.experience_years || 0);
    setPropertyTypes(p.specialties || []);
    setPreferredLang(
      p.language === "pt" ? "Portuguese" :
      p.language === "es" ? "Spanish" : "English"
    );
  }, [profile, open]);

  const toggle = (
    list: string[], setter: (v: string[]) => void, item: string
  ) => {
    setter(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  };

  const handleSave = async () => {
    if (!user) return;
    const { containsContactInfo } = await import("@/lib/contactFilter");
    if (containsContactInfo(bio)) {
      toast.error("Please remove contact info from your bio.");
      return;
    }
    setSaving(true);
    try {
      const updates: any = {
        full_name: fullName,
        bio: bio.slice(0, 200),
      };
      if (isOwner) {
        updates.specialties = propertyTypes;
        updates.language =
          preferredLang === "Portuguese" ? "pt" :
          preferredLang === "Spanish" ? "es" : "en";
      } else {
        updates.specialties = specialties;
        updates.languages = languages;
        updates.experience_years = years;
      }
      const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
      if (error) throw error;

      // Award profile_complete (+20) once when user fills meaningful fields
      const completeFields = isOwner
        ? !!(fullName && bio && propertyTypes.length > 0)
        : !!(fullName && bio && specialties.length > 0 && languages.length > 0);
      if (completeFields) {
        const { data: existing } = await supabase
          .from("point_history")
          .select("id")
          .eq("user_id", user.id)
          .eq("reason", "profile_complete")
          .maybeSingle();
        if (!existing) await awardPoints(user.id, "profile_complete");
      }

      await refreshProfile();
      toast.success("Profile updated");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg">Edit Profile</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">Full Name</label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="rounded-xl h-10"
              placeholder="Your full name"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">
              Bio <span className="text-muted-foreground">({bio.length}/200)</span>
            </label>
            <Textarea
              value={bio}
              maxLength={200}
              onChange={(e) => setBio(e.target.value)}
              className="rounded-xl min-h-[90px]"
              placeholder={
                isOwner
                  ? "Tell cleaners about your properties..."
                  : "Tell owners about yourself and your experience..."
              }
            />
          </div>

          {isOwner ? (
            <>
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Property Type</label>
                <div className="flex flex-wrap gap-2">
                  {OWNER_PROPERTY_TYPES.map((t) => (
                    <Chip
                      key={t}
                      active={propertyTypes.includes(t)}
                      onClick={() => toggle(propertyTypes, setPropertyTypes, t)}
                    >{t}</Chip>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Preferred Language</label>
                <div className="flex flex-wrap gap-2">
                  {OWNER_LANGS.map((l) => (
                    <Chip
                      key={l}
                      active={preferredLang === l}
                      onClick={() => setPreferredLang(l)}
                    >{l}</Chip>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Specialties</label>
                <div className="flex flex-wrap gap-2">
                  {WORKER_SPECIALTIES.map((s) => (
                    <Chip
                      key={s}
                      active={specialties.includes(s)}
                      onClick={() => toggle(specialties, setSpecialties, s)}
                    >{s}</Chip>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Languages Spoken</label>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map((l) => (
                    <Chip
                      key={l}
                      active={languages.includes(l)}
                      onClick={() => toggle(languages, setLanguages, l)}
                    >{l}</Chip>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">
                  Years of Experience
                </label>
                <Input
                  type="number"
                  min={0}
                  max={30}
                  value={years}
                  onChange={(e) =>
                    setYears(Math.max(0, Math.min(30, Number(e.target.value) || 0)))
                  }
                  className="rounded-xl h-10"
                />
              </div>
            </>
          )}

          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-11 rounded-xl gradient-primary text-primary-foreground font-semibold"
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

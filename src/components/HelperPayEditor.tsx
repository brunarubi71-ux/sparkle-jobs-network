import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  jobId: string;
  currentPay: number | null;
  onSaved: () => void;
}

export default function HelperPayEditor({ jobId, currentPay, onSaved }: Props) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentPay ? String(currentPay) : "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const num = parseFloat(value);
    if (!(num > 0)) {
      toast.error(t("post.helper_pay_required"));
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("jobs").update({ helper_pay: num } as any).eq("id", jobId);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success(t("post.helper_pay_updated"));
    setEditing(false);
    onSaved();
  };

  return (
    <div className="bg-card rounded-2xl shadow-card p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-foreground">💵 {t("post.helper_pay_label")}</p>
        {!editing && (
          <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs text-primary font-medium">
            <Pencil className="w-3.5 h-3.5" /> {t("common.edit")}
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex gap-2">
          <Input
            type="number"
            min="1"
            placeholder="ex: 60"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="rounded-xl h-10 flex-1"
            autoFocus
          />
          <Button size="icon" onClick={save} disabled={saving} className="rounded-xl h-10 w-10 gradient-primary text-white">
            <Check className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="outline" onClick={() => { setEditing(false); setValue(currentPay ? String(currentPay) : ""); }} className="rounded-xl h-10 w-10">
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <p className="text-2xl font-bold text-foreground">
          ${currentPay ? Number(currentPay).toFixed(2) : <span className="text-destructive text-sm font-normal">{t("post.helper_pay_required")}</span>}
        </p>
      )}
      <p className="text-xs text-muted-foreground mt-1">{t("post.helper_pay_hint")}</p>
    </div>
  );
}

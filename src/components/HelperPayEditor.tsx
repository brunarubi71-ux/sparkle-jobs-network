import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Check, X, Share2, Copy, Users } from "lucide-react";
import { toast } from "sonner";

interface Props {
  jobId: string;
  currentPay: number | null;
  onSaved: () => void;
}

export default function HelperPayEditor({ jobId, currentPay, onSaved }: Props) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(!currentPay);
  const [value, setValue] = useState(currentPay ? String(currentPay) : "");
  const [saving, setSaving] = useState(false);
  const [shared, setShared] = useState(false);

  const inviteLink = `${window.location.origin}/helper-invite/${jobId}`;

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

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Convite de Trabalho — Shinely Jobs",
          text: `Preciso de uma helper para este trabalho. Você vai receber $${Number(currentPay).toFixed(2)}. Aceite aqui:`,
          url: inviteLink,
        });
      } else {
        await navigator.clipboard.writeText(inviteLink);
        setShared(true);
        setTimeout(() => setShared(false), 2500);
        toast.success("Link copiado!");
      }
    } catch {
      await navigator.clipboard.writeText(inviteLink);
      toast.success("Link copiado!");
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
          <Users className="w-4 h-4 text-amber-600" />
        </div>
        <div>
          <p className="text-sm font-bold text-amber-900">Precisa de Helper?</p>
          <p className="text-xs text-amber-700">Defina o valor e compartilhe o trabalho</p>
        </div>
      </div>

      {/* Pay field */}
      <div className="bg-white rounded-xl p-3 border border-amber-200">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-semibold text-foreground">💵 Valor para a helper</p>
          {!editing && currentPay && (
            <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs text-primary font-medium">
              <Pencil className="w-3 h-3" /> Editar
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
            {currentPay && (
              <Button size="icon" variant="outline" onClick={() => { setEditing(false); setValue(String(currentPay)); }} className="rounded-xl h-10 w-10">
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        ) : (
          <p className="text-2xl font-bold text-foreground">
            ${currentPay ? Number(currentPay).toFixed(2) : <span className="text-destructive text-sm font-normal">Não definido</span>}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">{t("post.helper_pay_hint")}</p>
      </div>

      {/* Share button — only visible after pay is set */}
      {currentPay && !editing && (
        <Button
          onClick={share}
          className="w-full h-12 rounded-xl font-semibold text-sm"
          style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "white" }}
        >
          {shared ? <Copy className="w-4 h-4 mr-2" /> : <Share2 className="w-4 h-4 mr-2" />}
          {shared ? "Link copiado!" : "Compartilhar trabalho via WhatsApp / Link"}
        </Button>
      )}
    </div>
  );
}

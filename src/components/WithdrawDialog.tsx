import { useState } from "react";
import { ArrowUpRight, Banknote, Zap, Clock, RefreshCw, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletBalance: number;
  onSuccess: (newBalance: number) => void;
}

const PRESETS = [20, 50, 100, 200];
const INSTANT_FEE_RATE = 0.015; // 1.5%
const MIN_INSTANT_FEE = 0.50;   // $0.50 minimum

function calcInstantFee(amount: number): number {
  return Math.max(MIN_INSTANT_FEE, Math.round(amount * INSTANT_FEE_RATE * 100) / 100);
}

export function WithdrawDialog({ open, onOpenChange, walletBalance, onSuccess }: Props) {
  const [amount, setAmount] = useState("");
  const [instant, setInstant] = useState(false);
  const [loading, setLoading] = useState(false);

  const parsed = parseFloat(amount);
  const isValidAmount = Number.isFinite(parsed) && parsed >= 5 && parsed <= walletBalance;

  const fee = isValidAmount && instant ? calcInstantFee(parsed) : 0;
  const youReceive = isValidAmount ? parsed - fee : 0;
  const arrivalText = instant ? "~30 minutos" : "2–5 dias úteis";

  const handleWithdraw = async () => {
    if (!isValidAmount) return;
    setLoading(true);
    try {
      const res = await supabase.functions.invoke("create-payout", {
        body: { amount: parsed, instant },
      });

      if (res.error) throw new Error(res.error.message);
      const data = res.data as { newBalance: number; netReceived: number; estimatedArrival: string };

      toast.success(
        instant
          ? `$${youReceive.toFixed(2)} arrives in your bank within 30 minutes!`
          : `$${parsed.toFixed(2)} is on its way — arrives in 2–5 business days.`,
        { duration: 6000 }
      );
      onSuccess(data.newBalance);
      onOpenChange(false);
      setAmount("");
      setInstant(false);
    } catch (err) {
      toast.error((err as Error).message || "Withdrawal failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-primary" />
            Withdraw to bank
          </DialogTitle>
          <DialogDescription>
            Available: <span className="font-semibold text-foreground">${walletBalance.toFixed(2)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">

          {/* Speed selector */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setInstant(false)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-2xl border-2 px-3 py-3 transition-all",
                !instant
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/40"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center",
                !instant ? "bg-primary/15" : "bg-muted"
              )}>
                <Clock className={cn("w-4 h-4", !instant ? "text-primary" : "text-muted-foreground")} />
              </div>
              <span className={cn("text-sm font-bold", !instant ? "text-primary" : "text-foreground")}>
                Standard
              </span>
              <span className="text-[11px] text-muted-foreground text-center leading-tight">
                2–5 dias úteis<br />
                <span className="font-semibold text-emerald-600">Grátis</span>
              </span>
            </button>

            <button
              onClick={() => setInstant(true)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-2xl border-2 px-3 py-3 transition-all",
                instant
                  ? "border-amber-400 bg-amber-50"
                  : "border-border bg-card hover:border-amber-300"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center",
                instant ? "bg-amber-100" : "bg-muted"
              )}>
                <Zap className={cn("w-4 h-4", instant ? "text-amber-500" : "text-muted-foreground")} />
              </div>
              <span className={cn("text-sm font-bold", instant ? "text-amber-600" : "text-foreground")}>
                Instantâneo
              </span>
              <span className="text-[11px] text-muted-foreground text-center leading-tight">
                ~30 minutos<br />
                <span className={cn("font-semibold", instant ? "text-amber-600" : "text-muted-foreground")}>
                  +1,5% de taxa
                </span>
              </span>
            </button>
          </div>

          {/* Preset amounts */}
          <div className="grid grid-cols-4 gap-2">
            {PRESETS.filter(p => p <= walletBalance).map((p) => (
              <Button
                key={p}
                type="button"
                variant={amount === String(p) ? "default" : "outline"}
                className="rounded-xl"
                onClick={() => setAmount(String(p))}
              >
                ${p}
              </Button>
            ))}
          </div>

          {/* Custom amount */}
          <div className="space-y-1.5">
            <Label htmlFor="withdraw-amount">Valor (USD)</Label>
            <Input
              id="withdraw-amount"
              type="number"
              inputMode="decimal"
              min="5"
              max={walletBalance}
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="rounded-xl h-11"
            />
          </div>

          {/* Fee breakdown — only shown when amount is valid */}
          {isValidAmount && (
            <div className={cn(
              "rounded-xl p-3 space-y-1.5 border",
              instant ? "bg-amber-50 border-amber-200" : "bg-muted/50 border-border"
            )}>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Valor solicitado</span>
                <span className="font-medium">${parsed.toFixed(2)}</span>
              </div>
              {instant && (
                <div className="flex justify-between text-sm">
                  <span className="text-amber-600 flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    Taxa instantânea (1,5%)
                  </span>
                  <span className="font-medium text-amber-600">−${fee.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold border-t pt-1.5 mt-1.5" style={{ borderColor: instant ? "#fcd34d" : undefined }}>
                <span className="text-foreground">Você recebe</span>
                <span className={instant ? "text-amber-700" : "text-emerald-600"}>
                  ${youReceive.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-1 pt-0.5">
                <Info className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                <span className="text-[11px] text-muted-foreground">
                  Previsão de chegada: <strong>{arrivalText}</strong>
                </span>
              </div>
            </div>
          )}

          <Button
            onClick={handleWithdraw}
            disabled={!isValidAmount || loading}
            className={cn(
              "w-full h-12 rounded-xl font-semibold gap-2 text-white",
              instant
                ? "bg-amber-500 hover:bg-amber-600"
                : "gradient-primary hover:opacity-90"
            )}
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : instant ? (
              <Zap className="w-4 h-4" />
            ) : (
              <ArrowUpRight className="w-4 h-4" />
            )}
            {loading
              ? "Processando..."
              : isValidAmount
                ? instant
                  ? `Receber $${youReceive.toFixed(2)} agora`
                  : `Sacar $${parsed.toFixed(2)}`
                : "Digite um valor"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

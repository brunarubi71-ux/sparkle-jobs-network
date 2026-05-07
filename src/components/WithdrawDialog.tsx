import { useState } from "react";
import { ArrowUpRight, Banknote, RefreshCw } from "lucide-react";
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletBalance: number;
  onSuccess: (newBalance: number) => void;
}

const PRESETS = [20, 50, 100, 200];

export function WithdrawDialog({ open, onOpenChange, walletBalance, onSuccess }: Props) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const parsed = parseFloat(amount);
  const isValid = Number.isFinite(parsed) && parsed >= 5 && parsed <= walletBalance;

  const handleWithdraw = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      const res = await supabase.functions.invoke("create-payout", {
        body: { amount: parsed },
      });

      if (res.error) throw new Error(res.error.message);
      const data = res.data as { newBalance: number; transferId: string };

      toast.success(`$${parsed.toFixed(2)} will be in your bank account within 2–5 business days.`);
      onSuccess(data.newBalance);
      onOpenChange(false);
      setAmount("");
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
            Available balance: <span className="font-semibold text-foreground">${walletBalance.toFixed(2)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
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
            <Label htmlFor="withdraw-amount">Amount (USD)</Label>
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
            <p className="text-xs text-muted-foreground">Minimum $5.00 · funds arrive in 2–5 business days</p>
          </div>

          <Button
            onClick={handleWithdraw}
            disabled={!isValid || loading}
            className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold hover:opacity-90 gap-2"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowUpRight className="w-4 h-4" />
            )}
            {loading ? "Processing..." : `Withdraw $${Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00"}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

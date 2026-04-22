import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Wallet as WalletIcon, Plus, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import BottomNav from "@/components/BottomNav";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { WalletStripeCheckout } from "@/components/WalletStripeCheckout";
import { toast } from "sonner";

interface WalletTransaction {
  id: string;
  amount: number;
  type: "credit" | "debit";
  description: string;
  job_id: string | null;
  created_at: string;
}

const PRESET_AMOUNTS = [10, 25, 50, 100];

export default function Wallet() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [amountInput, setAmountInput] = useState<string>("25");
  const [checkoutAmountCents, setCheckoutAmountCents] = useState<number>(0);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [{ data: profileData }, { data: txData }] = await Promise.all([
        supabase.from("profiles").select("wallet_balance").eq("id", user.id).single() as any,
        supabase
          .from("wallet_transactions" as any)
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);
      setBalance(Number((profileData as any)?.wallet_balance || 0));
      setTransactions((txData as any) || []);
      setLoading(false);
    };
    load();
  }, [user]);

  const handleProceed = () => {
    const parsed = parseFloat(amountInput);
    if (!parsed || parsed < 1) {
      toast.error("Minimum top-up is $1.00");
      return;
    }
    const cents = Math.round(parsed * 100);
    setCheckoutAmountCents(cents);
    setAddOpen(false);
    setCheckoutOpen(true);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <PaymentTestModeBanner />
      <div className="gradient-primary px-4 pt-8 pb-6">
        <h1 className="text-xl font-bold text-primary-foreground">Wallet</h1>
        <p className="text-primary-foreground/70 text-sm">Manage your balance and transactions</p>
      </div>

      <div className="px-4 mt-4 space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl shadow-card p-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center">
              <WalletIcon className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Current Balance</p>
              <p className="text-3xl font-bold text-foreground">${balance.toFixed(2)}</p>
            </div>
          </div>
          <Button
            onClick={() => setAddOpen(true)}
            className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold hover:opacity-90 mt-4"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Funds
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-2xl shadow-card p-4"
        >
          <h2 className="text-base font-semibold text-foreground mb-3">Transaction History</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No transactions yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Description</TableHead>
                  <TableHead className="text-xs text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-xs text-muted-foreground py-2">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-xs text-foreground py-2">
                      <div className="flex items-center gap-1.5">
                        {tx.type === "credit" ? (
                          <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        ) : (
                          <ArrowUpRight className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                        )}
                        <span className="truncate">{tx.description}</span>
                      </div>
                    </TableCell>
                    <TableCell
                      className={`text-xs font-semibold text-right py-2 ${
                        tx.type === "credit" ? "text-emerald-600" : "text-destructive"
                      }`}
                    >
                      {tx.type === "credit" ? "+" : "-"}${Number(tx.amount).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </motion.div>
      </div>

      {/* Amount picker dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Add funds</DialogTitle>
            <DialogDescription>Choose how much you'd like to add to your wallet.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-4 gap-2">
              {PRESET_AMOUNTS.map((amt) => (
                <Button
                  key={amt}
                  type="button"
                  variant={amountInput === String(amt) ? "default" : "outline"}
                  className="rounded-xl"
                  onClick={() => setAmountInput(String(amt))}
                >
                  ${amt}
                </Button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="custom-amount">Custom amount (USD)</Label>
              <Input
                id="custom-amount"
                type="number"
                inputMode="decimal"
                min="1"
                step="0.01"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="rounded-xl h-11"
              />
            </div>
            <Button
              onClick={handleProceed}
              className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold hover:opacity-90"
            >
              Continue to payment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stripe checkout dialog */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen} modal={false}>
        <DialogContent
          className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Add ${(checkoutAmountCents / 100).toFixed(2)} to wallet</DialogTitle>
            <DialogDescription>Complete your payment to top up your balance.</DialogDescription>
          </DialogHeader>
          {user && checkoutAmountCents > 0 && (
            <WalletStripeCheckout
              amountInCents={checkoutAmountCents}
              customerEmail={user.email || undefined}
              userId={user.id}
            />
          )}
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}

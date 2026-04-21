import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Wallet as WalletIcon, Plus, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import BottomNav from "@/components/BottomNav";
import { toast } from "sonner";

interface WalletTransaction {
  id: string;
  amount: number;
  type: "credit" | "debit";
  description: string;
  job_id: string | null;
  created_at: string;
}

export default function Wallet() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleAddFunds = () => {
    toast.info("Coming soon when Stripe is ready");
  };

  return (
    <div className="min-h-screen bg-background pb-20">
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
            onClick={handleAddFunds}
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

      <BottomNav />
    </div>
  );
}

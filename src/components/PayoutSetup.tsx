import { useState } from "react";
import { Landmark, CheckCircle2, RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  connectAccountId: string | null;
  onboarded: boolean;
  /** Called after successful onboarding redirect so parent can refresh profile */
  onRefresh?: () => void;
}

export function PayoutSetup({ connectAccountId, onboarded, onRefresh }: Props) {
  const [loading, setLoading] = useState(false);

  const handleSetup = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please sign in again"); return; }

      const returnUrl = `${window.location.origin}/earnings`;

      const res = await supabase.functions.invoke("create-connect-account", {
        body: { returnUrl },
      });

      if (res.error) throw new Error(res.error.message);

      const { url } = res.data as { url: string };
      // Open Stripe onboarding in same tab so the return_url brings them back
      window.location.href = url;
    } catch (err) {
      toast.error((err as Error).message || "Could not start setup. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (onboarded) {
    return (
      <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-emerald-800">Bank account connected</p>
          <p className="text-xs text-emerald-600 mt-0.5">Withdrawals will be sent to your registered bank account.</p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="text-emerald-700 hover:text-emerald-900 shrink-0"
          onClick={handleSetup}
          disabled={loading}
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Update"}
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
          <Landmark className="w-5 h-5 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-900">Set up your bank account to receive payments</p>
          <p className="text-xs text-amber-700 mt-1 leading-relaxed">
            You need to link a bank account before you can withdraw your earnings.
            It takes about 2 minutes — Stripe handles it securely.
          </p>
          <Button
            onClick={handleSetup}
            disabled={loading}
            className="mt-3 h-9 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold gap-2"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <ExternalLink className="w-4 h-4" />
            )}
            {loading ? "Opening Stripe..." : "Connect bank account"}
          </Button>
        </div>
      </div>
    </div>
  );
}

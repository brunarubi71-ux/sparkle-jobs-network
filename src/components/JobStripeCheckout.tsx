import { useEffect, useState } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface JobCheckoutProps {
  amountInCents: number;
  jobId: string;
  jobTitle?: string;
  customerEmail?: string;
  userId?: string;
  returnUrl?: string;
}

export function JobStripeCheckout({
  amountInCents,
  jobId,
  jobTitle,
  customerEmail,
  userId,
  returnUrl,
}: JobCheckoutProps) {
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  // Validate props up-front to avoid crashing the iframe with bad input.
  useEffect(() => {
    if (!jobId) {
      setError("Missing job reference. Please try posting the job again.");
    } else if (!amountInCents || amountInCents < 50) {
      setError("Invalid payment amount. Minimum is $0.50.");
    } else {
      setError(null);
      setReady(true);
    }
  }, [jobId, amountInCents, retryKey]);

  const fetchClientSecret = async (): Promise<string> => {
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("create-job-checkout", {
        body: {
          amountInCents,
          jobId,
          jobTitle,
          customerEmail,
          userId,
          returnUrl,
          environment: getStripeEnvironment(),
        },
      });

      if (invokeError) {
        console.error("[JobStripeCheckout] invoke error:", invokeError);
        throw new Error(invokeError.message || "Could not reach payment service.");
      }
      if (data?.error) {
        console.error("[JobStripeCheckout] server error:", data.error);
        throw new Error(typeof data.error === "string" ? data.error : "Payment service returned an error.");
      }
      if (!data?.clientSecret) {
        throw new Error("Payment session could not be created.");
      }
      return data.clientSecret as string;
    } catch (e) {
      const msg = (e as Error).message || "Failed to start payment.";
      console.error("[JobStripeCheckout] fetchClientSecret failed:", e);
      setError(msg);
      toast.error(msg);
      // Re-throw so the provider knows it failed, but our UI already handled it.
      throw e;
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center text-center gap-3 py-6">
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-destructive" />
        </div>
        <p className="text-sm font-medium text-foreground">Payment couldn't start</p>
        <p className="text-xs text-muted-foreground max-w-sm">{error}</p>
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          onClick={() => {
            setError(null);
            setReady(false);
            setRetryKey((k) => k + 1);
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div id="job-checkout">
      <EmbeddedCheckoutProvider
        key={retryKey}
        stripe={getStripe()}
        options={{ fetchClientSecret }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import type { Stripe } from "@stripe/stripe-js";
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

/**
 * Error boundary scoped to the Stripe checkout subtree.
 * Prevents Stripe Elements crashes (especially on iOS Safari) from
 * blanking the entire app.
 */
class CheckoutErrorBoundary extends React.Component<
  { onError: (msg: string) => void; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("[JobStripeCheckout] render crash:", error);
    this.props.onError(error?.message || "Payment form crashed.");
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

function JobStripeCheckoutInner({
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
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);

  // Validate props up-front
  useEffect(() => {
    if (!jobId) {
      setError("Missing job reference. Please try posting the job again.");
      return;
    }
    if (!amountInCents || amountInCents < 50) {
      setError("Invalid payment amount. Minimum is $0.50.");
      return;
    }
    setError(null);
    setReady(true);
  }, [jobId, amountInCents, retryKey]);

  // Safely load Stripe.js (Safari can fail when third-party scripts are blocked)
  useEffect(() => {
    if (!ready) return;
    try {
      const p = getStripe();
      // Catch async rejection so it never bubbles up unhandled
      p.catch((e) => {
        console.error("[JobStripeCheckout] loadStripe rejected:", e);
        const msg = "Could not load Stripe. Please disable content blockers and try again.";
        setError(msg);
        toast.error(msg);
      });
      setStripePromise(p);
    } catch (e) {
      console.error("[JobStripeCheckout] getStripe threw:", e);
      const msg = (e as Error).message || "Could not initialize Stripe.";
      setError(msg);
      toast.error(msg);
    }
  }, [ready, retryKey]);

  // Fetch the client secret eagerly so we can avoid mounting Stripe with null.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
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
          console.error("[JobStripeCheckout] edge function invoke error:", invokeError);
          throw new Error(invokeError.message || "Could not reach payment service.");
        }
        if (data?.error) {
          console.error("[JobStripeCheckout] edge function returned error payload:", data);
          const errMsg = typeof data.error === "string" ? data.error : JSON.stringify(data.error);
          throw new Error(errMsg);
        }
        if (!data?.clientSecret) {
          console.error("[JobStripeCheckout] no clientSecret in response:", data);
          throw new Error("Payment session could not be created (no client secret returned).");
        }
        if (!cancelled) setClientSecret(data.clientSecret as string);
      } catch (e) {
        if (cancelled) return;
        const msg = (e as Error).message || "Failed to start payment.";
        console.error("[JobStripeCheckout] fetchClientSecret failed:", e);
        setError(msg);
        toast.error(`Payment error: ${msg}`, { duration: 8000 });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, retryKey, amountInCents, jobId, jobTitle, customerEmail, userId, returnUrl]);

  const options = useMemo(
    () => (clientSecret ? { fetchClientSecret: async () => clientSecret } : null),
    [clientSecret],
  );

  const handleRetry = () => {
    setError(null);
    setReady(false);
    setClientSecret(null);
    setStripePromise(null);
    setRetryKey((k) => k + 1);
  };

  if (error) {
    return (
      <div className="flex flex-col items-center text-center gap-3 py-6">
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-destructive" />
        </div>
        <p className="text-sm font-medium text-foreground">Payment couldn't start</p>
        <p className="text-xs text-muted-foreground max-w-sm">{error}</p>
        <Button type="button" variant="outline" className="rounded-xl" onClick={handleRetry}>
          Try again
        </Button>
      </div>
    );
  }

  if (!ready || !clientSecret || !options || !stripePromise) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div id="job-checkout">
      <EmbeddedCheckoutProvider key={retryKey} stripe={stripePromise} options={options}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}

export function JobStripeCheckout(props: JobCheckoutProps) {
  const [boundaryError, setBoundaryError] = useState<string | null>(null);

  if (boundaryError) {
    return (
      <div className="flex flex-col items-center text-center gap-3 py-6">
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-destructive" />
        </div>
        <p className="text-sm font-medium text-foreground">Payment couldn't load</p>
        <p className="text-xs text-muted-foreground max-w-sm">{boundaryError}</p>
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          onClick={() => setBoundaryError(null)}
        >
          Try again
        </Button>
      </div>
    );
  }

  return (
    <CheckoutErrorBoundary
      onError={(msg) => {
        toast.error(msg);
        setBoundaryError(msg);
      }}
    >
      <JobStripeCheckoutInner {...props} />
    </CheckoutErrorBoundary>
  );
}

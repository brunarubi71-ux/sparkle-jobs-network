import React, { useEffect, useMemo, useState } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import type { Stripe } from "@stripe/stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WalletCheckoutProps {
  amountInCents: number;
  customerEmail?: string;
  userId: string;
  returnUrl?: string;
}

class CheckoutErrorBoundary extends React.Component<
  { onError: (msg: string) => void; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    console.error("[WalletStripeCheckout] render crash:", error);
    this.props.onError(error?.message || "Payment form crashed.");
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

function Inner({ amountInCents, customerEmail, userId, returnUrl }: WalletCheckoutProps) {
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);

  useEffect(() => {
    if (!userId) {
      setError("You must be signed in to add funds.");
      return;
    }
    if (!amountInCents || amountInCents < 100) {
      setError("Minimum top-up is $1.00.");
      return;
    }
    setError(null);
  }, [userId, amountInCents, retryKey]);

  useEffect(() => {
    if (error) return;
    try {
      const p = getStripe();
      p.catch((e) => {
        console.error("[WalletStripeCheckout] loadStripe rejected:", e);
        const msg = "Could not load Stripe. Please disable content blockers and try again.";
        setError(msg);
        toast.error(msg);
      });
      setStripePromise(p);
    } catch (e) {
      console.error("[WalletStripeCheckout] getStripe threw:", e);
      const msg = (e as Error).message || "Could not initialize Stripe.";
      setError(msg);
      toast.error(msg);
    }
  }, [error, retryKey]);

  useEffect(() => {
    if (error) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error: invokeError } = await supabase.functions.invoke("create-wallet-checkout", {
          body: {
            amountInCents,
            customerEmail,
            userId,
            returnUrl,
            environment: getStripeEnvironment(),
          },
        });
        if (invokeError) {
          console.error("[WalletStripeCheckout] invoke error:", invokeError);
          throw new Error(invokeError.message || "Could not reach payment service.");
        }
        if (data?.error) {
          console.error("[WalletStripeCheckout] returned error:", data);
          const errMsg = typeof data.error === "string" ? data.error : JSON.stringify(data.error);
          throw new Error(errMsg);
        }
        if (!data?.clientSecret) {
          console.error("[WalletStripeCheckout] no clientSecret:", data);
          throw new Error("Payment session could not be created.");
        }
        if (!cancelled) setClientSecret(data.clientSecret as string);
      } catch (e) {
        if (cancelled) return;
        const msg = (e as Error).message || "Failed to start payment.";
        console.error("[WalletStripeCheckout] fetchClientSecret failed:", e);
        setError(msg);
        toast.error(`Payment error: ${msg}`, { duration: 8000 });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [error, retryKey, amountInCents, customerEmail, userId, returnUrl]);

  const options = useMemo(
    () => (clientSecret ? { fetchClientSecret: async () => clientSecret } : null),
    [clientSecret],
  );

  const handleRetry = () => {
    setError(null);
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
        <p className="text-xs text-muted-foreground max-w-sm break-words">{error}</p>
        <Button type="button" variant="outline" className="rounded-xl" onClick={handleRetry}>
          Try again
        </Button>
      </div>
    );
  }

  if (!clientSecret || !options || !stripePromise) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div id="wallet-checkout">
      <EmbeddedCheckoutProvider key={retryKey} stripe={stripePromise} options={options}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}

export function WalletStripeCheckout(props: WalletCheckoutProps) {
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
      <Inner {...props} />
    </CheckoutErrorBoundary>
  );
}

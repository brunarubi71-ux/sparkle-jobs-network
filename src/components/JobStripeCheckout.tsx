import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";

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
  const fetchClientSecret = async (): Promise<string> => {
    const { data, error } = await supabase.functions.invoke("create-job-checkout", {
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
    if (error || !data?.clientSecret) {
      throw new Error(error?.message || "Failed to create checkout session");
    }
    return data.clientSecret;
  };

  return (
    <div id="job-checkout">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}

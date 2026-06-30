import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// Landing page after Google OAuth redirect (PKCE flow).
// Supabase exchanges the ?code= param automatically (detectSessionInUrl).
// We check for an existing session first (in case the exchange finished
// before our listener was registered), then fall back to onAuthStateChange.
export default function AuthCallback() {
  const navigate = useNavigate();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    let unsubscribed = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (unsubscribed) return;
        if (event === "SIGNED_IN" && session) {
          unsubscribed = true;
          subscription.unsubscribe();
          navigate("/", { replace: true });
        } else if (event === "SIGNED_OUT") {
          unsubscribed = true;
          subscription.unsubscribe();
          navigate("/auth", { replace: true });
        }
      }
    );

    // Also check immediately — the code exchange may have already completed
    // before our onAuthStateChange listener was registered.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (unsubscribed) return;
      if (session) {
        unsubscribed = true;
        subscription.unsubscribe();
        navigate("/", { replace: true });
      }
    });

    // Fallback: if nothing resolves in 10s, go to auth
    const timer = setTimeout(() => {
      if (!unsubscribed) {
        unsubscribed = true;
        subscription.unsubscribe();
        navigate("/auth", { replace: true });
      }
    }, 10000);

    return () => {
      clearTimeout(timer);
      if (!unsubscribed) {
        unsubscribed = true;
        subscription.unsubscribe();
      }
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
    </div>
  );
}

import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// Landing page after Google OAuth redirect (PKCE flow).
// Supabase exchanges the ?code= param for a session automatically when
// detectSessionInUrl is true. We just wait for the session and redirect.
export default function AuthCallback() {
  const navigate = useNavigate();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session) {
          subscription.unsubscribe();
          navigate("/", { replace: true });
        } else if (event === "SIGNED_OUT") {
          subscription.unsubscribe();
          navigate("/auth", { replace: true });
        }
      }
    );

    // Fallback: if no event fires in 8s, go to auth
    const timer = setTimeout(() => {
      subscription.unsubscribe();
      navigate("/auth", { replace: true });
    }, 8000);

    return () => {
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
    </div>
  );
}

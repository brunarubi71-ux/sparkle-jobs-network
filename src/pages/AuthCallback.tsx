import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// PKCE OAuth callback page.
// Uses exchangeCodeForSession() directly instead of getSession() to avoid a
// race condition: AuthProvider also calls getSession() on mount, and with
// detectSessionInUrl: true both callers would compete for the same one-time
// PKCE code — whichever lost would trigger SIGNED_OUT, sending the user back
// to /auth. With detectSessionInUrl: false in the client, only this page
// exchanges the code, while AuthProvider safely reads the stored session.
export default function AuthCallback() {
  const navigate = useNavigate();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const errorParam = params.get("error");

    if (errorParam || !code) {
      navigate("/auth", { replace: true });
      return;
    }

    // 15s hard fallback in case the network never responds
    const fallback = setTimeout(() => navigate("/auth", { replace: true }), 15000);

    supabase.auth.exchangeCodeForSession(code)
      .then(({ error }) => {
        clearTimeout(fallback);
        // On success, onAuthStateChange(SIGNED_IN) has already fired inside
        // the Supabase library, so AuthProvider's user state is already set.
        navigate(error ? "/auth" : "/", { replace: true });
      })
      .catch(() => {
        clearTimeout(fallback);
        navigate("/auth", { replace: true });
      });

    return () => clearTimeout(fallback);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
    </div>
  );
}

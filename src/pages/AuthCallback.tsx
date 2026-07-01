import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// OAuth callback page for PKCE flow.
// Strategy: check getSession() first (code exchange may already be done),
// then register onAuthStateChange as fallback. Whichever fires first wins.
export default function AuthCallback() {
  const navigate = useNavigate();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    let done = false;

    const goHome = () => {
      if (done) return;
      done = true;
      navigate("/", { replace: true });
    };

    const goAuth = () => {
      if (done) return;
      done = true;
      navigate("/auth", { replace: true });
    };

    // Register listener first so we don't miss events that fire async
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (done) return;
      if (event === "SIGNED_IN" && session) {
        subscription.unsubscribe();
        goHome();
      } else if (event === "SIGNED_OUT") {
        subscription.unsubscribe();
        goAuth();
      }
    });

    // Also check immediately — exchange may already be complete
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (done) return;
      if (session) {
        subscription.unsubscribe();
        goHome();
      }
    }).catch(() => {
      subscription.unsubscribe();
      goAuth();
    });

    // Hard fallback: 12s max wait
    const timer = setTimeout(() => {
      subscription.unsubscribe();
      goAuth();
    }, 12000);

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

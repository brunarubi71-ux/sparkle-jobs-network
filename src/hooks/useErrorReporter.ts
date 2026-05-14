import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useErrorReporter() {
  const { user, profile } = useAuth();

  const reportError = useCallback(async (context: string, error: Error | string) => {
    if (!user) return;
    try {
      await (supabase.from as any)("error_reports").insert({
        user_id: user.id,
        user_email: (profile as any)?.email || user.email || "",
        context,
        error_message: typeof error === "string" ? error : error.message,
      });
    } catch (e) {
      console.error("[reportError]", e);
    }
  }, [user, profile]);

  return { reportError };
}

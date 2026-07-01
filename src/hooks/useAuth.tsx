import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { getJobsUsedThisWeek } from "@/lib/planLimits";

export { getJobsUsedThisWeek } from "@/lib/planLimits";

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  role: "cleaner" | "owner" | "admin";
  is_premium: boolean;
  premium_status: string | null;
  free_trial_started_at: string | null;
  free_trial_ends_at: string | null;
  jobs_used_today: number;
  jobs_used_date: string | null;
  free_contacts_used: number;
  bio: string | null;
  experience_years: number;
  specialties: string[];
  languages: string[];
  regions: string[];
  availability: string | null;
  transportation: string | null;
  supplies: boolean;
  company_name: string | null;
  business_type: string | null;
  years_in_business: number;
  avatar_url: string | null;
  jobs_completed: number;
  total_earnings: number;
  plan_tier: "free" | "premium" | "pro";
  has_transportation: boolean;
  worker_type: "cleaner" | "helper";
  helper_earnings?: number | null;
  is_available_now: boolean;
  stripe_connect_account_id: string | null;
  stripe_connect_onboarded: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileLoading: boolean;
  isPasswordRecovery: boolean;
  jobsUsedThisWeek: number;
  signUp: (email: string, password: string, fullName: string, role: "cleaner" | "owner", hasTransportation?: boolean) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearPasswordRecovery: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  // Guard against concurrent fetchProfile calls for the same user
  const profileFetchingRef = useRef<string | null>(null);

  const fetchProfileInner = async (userId: string, retries = 5): Promise<void> => {
    // Reduced delays: 300ms fast / 800ms slow — avoids exceeding UI timeouts
    const delay = retries > 3 ? 300 : 800;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      console.error("[useAuth] fetchProfile error:", error);
      if (retries > 0) {
        await new Promise((r) => setTimeout(r, delay));
        return fetchProfileInner(userId, retries - 1);
      }
      return;
    }
    if (!data && retries === 0) {
      await supabase.auth.signOut();
      return;
    }
    if (!data && retries > 0) {
      await new Promise((r) => setTimeout(r, delay));
      return fetchProfileInner(userId, retries - 1);
    }
    if (data) {
      // Apply pending Google role selection (set before OAuth redirect)
      const pendingRole = typeof window !== "undefined" ? localStorage.getItem("pending_google_role") : null;
      if (pendingRole && (pendingRole === "cleaner" || pendingRole === "owner")) {
        localStorage.removeItem("pending_google_role");
        try {
          const rpcTimeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("rpc_timeout")), 4000)
          );
          await Promise.race([
            supabase.rpc("choose_initial_role" as any, { p_role: pendingRole }),
            rpcTimeout,
          ]);
          const { data: updated } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
          setProfile((updated ?? data) as unknown as Profile);
          return;
        } catch (e) {
          console.error("[useAuth] choose_initial_role failed:", e);
        }
      }

      // First-time referral capture
      const ref = typeof window !== "undefined" ? localStorage.getItem("shinely_ref") : null;
      if (ref && ref !== userId && !(data as any).referred_by) {
        try {
          await supabase.from("profiles").update({ referred_by: ref } as any).eq("id", userId);
          const { awardPoints } = await import("@/lib/points");
          await awardPoints(ref, "referral_signup");
          localStorage.removeItem("shinely_ref");
          const { data: updated } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
          if (updated) setProfile(updated as unknown as Profile);
          return;
        } catch (e) {
          console.error("[useAuth] referral capture failed:", e);
        }
      }
      setProfile(data as unknown as Profile);
    }
  };

  const fetchProfile = async (userId: string, retries = 5) => {
    // Prevent concurrent fetches for the same user
    if (profileFetchingRef.current === userId) return;
    profileFetchingRef.current = userId;
    setProfileLoading(true);
    try {
      await fetchProfileInner(userId, retries);
    } finally {
      setProfileLoading(false);
      profileFetchingRef.current = null;
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  useEffect(() => {
    // Safety valve: unblock UI if Supabase never fires
    const safetyTimer = setTimeout(() => setLoading(false), 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        clearTimeout(safetyTimer);
        if (event === "PASSWORD_RECOVERY") {
          setIsPasswordRecovery(true);
          setSession(session);
          setUser(session?.user ?? null);
          if (session?.user) await fetchProfile(session.user.id);
          setLoading(false);
          return;
        }
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          // Await fetchProfile so loading stays true until profile is ready
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
          setIsPasswordRecovery(false);
        }
        setLoading(false);
      }
    );

    // Also check existing session on mount (covers page refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(safetyTimer);
      // onAuthStateChange will also fire — let it handle the profile fetch
      // to avoid duplicate concurrent calls (profileFetchingRef guards this)
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }).catch(() => {
      clearTimeout(safetyTimer);
      setLoading(false);
    });

    return () => {
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string, role: "cleaner" | "owner", hasTransportation?: boolean) => {
    const workerType = role === "cleaner" && hasTransportation === false ? "helper" : "cleaner";
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
          worker_type: workerType,
          has_transportation: hasTransportation ?? true,
        },
      },
    });
    if (error) throw error;
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setIsPasswordRecovery(false);
  };

  const clearPasswordRecovery = () => setIsPasswordRecovery(false);

  const jobsUsedThisWeek = profile
    ? getJobsUsedThisWeek(profile.jobs_used_date, profile.jobs_used_today)
    : 0;

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, profileLoading, isPasswordRecovery, jobsUsedThisWeek, signUp, signIn, signOut, refreshProfile, clearPasswordRecovery }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

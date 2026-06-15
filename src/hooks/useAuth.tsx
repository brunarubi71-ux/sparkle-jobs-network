import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { getJobsUsedThisWeek } from "@/lib/planLimits";

// Re-export so callers can do: import { getJobsUsedThisWeek } from "@/hooks/useAuth"
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
  isPasswordRecovery: boolean;
  /** Jobs used during the CURRENT week (resets when jobs_used_date is from a previous week). */
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
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      console.error("[useAuth] fetchProfile error:", error);
      return;
    }
    if (data) setProfile(data as unknown as Profile);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "PASSWORD_RECOVERY") {
          setIsPasswordRecovery(true);
          setSession(session);
          setUser(session?.user ?? null);
          if (session?.user) {
            setTimeout(() => fetchProfile(session.user.id), 0);
          }
          setLoading(false);
          return;
        }
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchProfile(session.user.id), 0);
        } else {
          setProfile(null);
          setIsPasswordRecovery(false);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
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
    <AuthContext.Provider value={{ user, session, profile, loading, isPasswordRecovery, jobsUsedThisWeek, signUp, signIn, signOut, refreshProfile, clearPasswordRecovery }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Briefcase, MessageCircle, Crown, User, PlusCircle, List, ClipboardList, DollarSign, Wallet } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { t } = useLanguage();
  const [pendingReviewCount, setPendingReviewCount] = useState(0);
  const [pendingApplicantsCount, setPendingApplicantsCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    if (!user || profile?.role !== "owner") {
      setPendingReviewCount(0);
      setPendingApplicantsCount(0);
      return;
    }

    const fetchCount = async () => {
      const { count } = await supabase
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id)
        .eq("status", "pending_review");
      setPendingReviewCount(count || 0);
    };

    const fetchPendingApplicants = async () => {
      // Get owner's open jobs
      const { data: openJobs } = await supabase
        .from("jobs")
        .select("id")
        .eq("owner_id", user.id)
        .eq("status", "open");
      const jobIds = (openJobs || []).map((j) => j.id);
      if (jobIds.length === 0) {
        setPendingApplicantsCount(0);
        return;
      }
      const { count } = await supabase
        .from("job_applications")
        .select("id", { count: "exact", head: true })
        .in("job_id", jobIds)
        .eq("status", "pending");
      setPendingApplicantsCount(count || 0);
    };

    fetchCount();
    fetchPendingApplicants();

    const channel = supabase
      .channel(`bottomnav-jobs-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs", filter: `owner_id=eq.${user.id}` },
        () => {
          fetchCount();
          fetchPendingApplicants();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "job_applications" },
        () => fetchPendingApplicants()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, profile?.role]);

  // Unread messages badge
  useEffect(() => {
    if (!user) {
      setUnreadMessages(0);
      return;
    }

    const lastVisitedKey = `chat_last_visited_${user.id}`;

    const computeUnread = async () => {
      // First-time visitors should not see old messages as "unread".
      // If no last-visited timestamp exists, seed it to "now" and show 0.
      let lastVisited = localStorage.getItem(lastVisitedKey);
      if (!lastVisited) {
        lastVisited = new Date().toISOString();
        try { localStorage.setItem(lastVisitedKey, lastVisited); } catch {}
        setUnreadMessages(0);
        return;
      }

      // Get conversations the user participates in
      const { data: convs } = await supabase
        .from("conversations")
        .select("id")
        .or(`cleaner_id.eq.${user.id},owner_id.eq.${user.id}`);

      const convIds = (convs || []).map((c) => c.id);
      if (convIds.length === 0) {
        setUnreadMessages(0);
        return;
      }

      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .in("conversation_id", convIds)
        .neq("sender_id", user.id)
        .gt("created_at", lastVisited);

      setUnreadMessages(count || 0);
    };

    computeUnread();

    // Clear badge as soon as the user lands on /chat
    if (location.pathname === "/chat" || location.pathname.startsWith("/chat/")) {
      localStorage.setItem(lastVisitedKey, new Date().toISOString());
      setUnreadMessages(0);
    }

    const channel = supabase
      .channel(`bottomnav-messages-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as { sender_id: string };
          if (msg.sender_id === user.id) return;
          // If currently on chat, don't increment — just update last-visited
          if (location.pathname === "/chat" || location.pathname.startsWith("/chat/")) {
            localStorage.setItem(lastVisitedKey, new Date().toISOString());
            return;
          }
          // Re-compute to ensure conversation membership is respected
          computeUnread();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, location.pathname]);

  const cleanerTabs = [
    { path: "/", label: t("nav.jobs"), icon: Briefcase, badge: 0 },
    { path: "/cleaner-my-jobs", label: t("nav.my_jobs"), icon: ClipboardList, badge: 0 },
    { path: "/earnings", label: t("nav.earnings"), icon: DollarSign, badge: 0 },
    { path: "/chat", label: t("nav.chat"), icon: MessageCircle, badge: unreadMessages },
    { path: "/premium", label: t("nav.premium"), icon: Crown, badge: 0 },
    { path: "/profile", label: t("nav.profile"), icon: User, badge: 0 },
  ];

  const ownerTabs = [
    { path: "/post-job", label: t("nav.post_job"), icon: PlusCircle, badge: 0 },
    { path: "/my-jobs", label: t("nav.my_jobs"), icon: List, badge: pendingReviewCount + pendingApplicantsCount },
    { path: "/wallet", label: t("nav.wallet"), icon: Wallet, badge: 0 },
    { path: "/chat", label: t("nav.chat"), icon: MessageCircle, badge: unreadMessages },
    { path: "/profile", label: t("nav.profile"), icon: User, badge: 0 },
  ];

  // Helpers use the same navigation as cleaners
  const tabs = profile?.role === "owner" ? ownerTabs : cleanerTabs;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
      <div className="flex flex-col">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto w-full">
          {tabs.map((tab) => {
            const active = location.pathname === tab.path;
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <div className="relative">
                  <tab.icon className={`w-5 h-5 ${active ? "text-primary" : ""}`} />
                  {tab.badge > 0 && (
                    <span
                      aria-label={`${tab.badge} pending`}
                      className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-card"
                    />
                  )}
                </div>
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
        <div className="border-t border-border/60 py-1.5 px-4 flex items-center justify-between gap-3 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <Link to="/terms" className="hover:text-primary">Terms</Link>
            <span aria-hidden="true">·</span>
            <Link to="/privacy" className="hover:text-primary">Privacy</Link>
            <span aria-hidden="true">·</span>
            <Link to="/cancellation" className="hover:text-primary">Cancellation</Link>
          </div>
          <LanguageSwitcher variant="floating" />
        </div>
      </div>
    </nav>
  );
}

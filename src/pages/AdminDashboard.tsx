import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sendNotification } from "@/lib/notifications";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Shield, Users, Briefcase, DollarSign, BarChart3, ShieldCheck,
  Check, X, Crown, AlertTriangle, Ban, RotateCcw, Search, Eye, TrendingUp,
  Webhook, ShieldOff, Settings2, Wallet, Star, EyeOff, Trash2,
  Megaphone, Settings, AlertOctagon, UsersRound, Plus, Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { toast } from "sonner";
import { awardPoints } from "@/lib/points";

type Tab = "metrics" | "revenue" | "users" | "identity" | "jobs" | "disputes" | "reviews" | "webhooks" | "settings" | "violations" | "teams";
type RoleFilter = "all" | "owner" | "cleaner" | "helper";
type StatusFilter = "all" | "verified" | "pending" | "unverified" | "suspended" | "banned";
type RevenueRange = "7" | "30" | "90" | "all";

export default function AdminDashboard() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("metrics");
  const [stats, setStats] = useState({
    users: 0, cleaners: 0, owners: 0, jobs: 0, openJobs: 0,
    activeJobs: 0, completedJobs: 0, totalRevenue: 0, premiumUsers: 0, openDisputes: 0,
  });
  const [users, setUsers] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [revenueRange, setRevenueRange] = useState<RevenueRange>("30");
  const [viewUser, setViewUser] = useState<any | null>(null);
  const [changeRoleUser, setChangeRoleUser] = useState<any | null>(null);
  const [changePlanUser, setChangePlanUser] = useState<any | null>(null);
  const [banUser, setBanUser] = useState<any | null>(null);
  const [walletUser, setWalletUser] = useState<any | null>(null);
  const [subOverrideUser, setSubOverrideUser] = useState<any | null>(null);
  const [overrideJob, setOverrideJob] = useState<any | null>(null);
  const [webhookEvents, setWebhookEvents] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [appSettings, setAppSettings] = useState<any[]>([]);
  const [violations, setViolations] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [teamInvites, setTeamInvites] = useState<any[]>([]);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [editSetting, setEditSetting] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile && (profile.role as string) !== "admin") {
      navigate("/");
      return;
    }
    if (profile) fetchAll();
  }, [profile]);

  const fetchAll = async () => {
    setLoading(true);
    const [profilesRes, jobsRes, disputesRes, webhooksRes, reviewsRes, settingsRes, violationsRes, teamMembersRes, teamInvitesRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("jobs").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("disputes").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("webhook_events").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("reviews").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("app_settings").select("*").order("key"),
      supabase.from("platform_violations").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("team_members").select("*").order("created_at", { ascending: false }),
      supabase.from("team_invites").select("*").order("created_at", { ascending: false }),
    ]);
    const p = profilesRes.data || [];
    const j = jobsRes.data || [];
    const d = disputesRes.data || [];
    const w = webhooksRes.data || [];
    const r = reviewsRes.data || [];
    setUsers(p);
    setJobs(j);
    setDisputes(d);
    setWebhookEvents(w);
    setReviews(r);
    setAppSettings(settingsRes.data || []);
    setViolations(violationsRes.data || []);
    setTeamMembers(teamMembersRes.data || []);
    setTeamInvites(teamInvitesRes.data || []);
    setStats({
      users: p.length,
      cleaners: p.filter((u: any) => u.role === "cleaner").length,
      owners: p.filter((u: any) => u.role === "owner").length,
      jobs: j.length,
      openJobs: j.filter((x: any) => x.status === "open").length,
      activeJobs: j.filter((x: any) => ["accepted", "in_progress", "pending_review"].includes(x.status)).length,
      completedJobs: j.filter((x: any) => x.status === "completed").length,
      totalRevenue: j.filter((x: any) => x.status === "completed").reduce((s: number, x: any) => s + Number(x.platform_fee || 0), 0),
      premiumUsers: p.filter((u: any) => u.is_premium).length,
      openDisputes: d.filter((x: any) => x.status === "open").length,
    });
    setLoading(false);
  };

  const handleLogout = async () => { await signOut(); navigate("/admin-login"); };

  const pendingIdentity = users.filter((u: any) => u.identity_status === "pending");

  const reviewIdentity = async (userId: string, decision: "approved" | "rejected", reason?: string) => {
    const update: any = {
      identity_status: decision,
      identity_reviewed_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("profiles").update(update).eq("id", userId);
    if (error) { toast.error(`Failed to ${decision === "approved" ? "approve" : "reject"} identity`); return; }

    // Notify the user about the identity decision
    if (decision === "approved") {
      await sendNotification({
        userId,
        title: "Identity Verified ✅",
        message: "Your identity has been verified! You can now apply for jobs.",
        type: "identity_approved",
        link: "/profile",
      });
    } else {
      await sendNotification({
        userId,
        title: "Identity Rejected ❌",
        message: reason
          ? `Your identity verification was rejected: ${reason}. Please resubmit your documents in your profile.`
          : "Your identity verification was rejected. Please resubmit your documents in your profile.",
        type: "identity_rejected",
        link: "/profile",
      });
    }

    if (decision === "approved") {
      try { await awardPoints(userId, "identity_verified"); } catch {}
      toast.success("✅ Identity approved successfully");
    } else {
      toast.success(`❌ Identity rejected${reason ? `: ${reason}` : ""}`);
    }
    fetchAll();
  };

  const getSignedDocUrl = async (path: string | null): Promise<string | null> => {
    if (!path) return null;
    const { data } = await supabase.storage.from("identity-docs").createSignedUrl(path, 60 * 10);
    return data?.signedUrl || null;
  };

  const toggleSuspend = async (u: any) => {
    const isSuspended = u.suspension_until && new Date(u.suspension_until) > new Date();
    const newValue = isSuspended ? null : new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
    const { error } = await supabase
      .from("profiles")
      .update({ suspension_until: newValue } as any)
      .eq("id", u.id);
    if (error) { toast.error("Failed to update account"); return; }
    toast.success(isSuspended ? "Account activated" : "Account suspended for 30 days");
    fetchAll();
  };

  const changeUserRole = async (userId: string, newRole: "cleaner" | "owner" | "admin") => {
    const { error } = await supabase.from("profiles").update({ role: newRole } as any).eq("id", userId);
    if (error) { toast.error("Failed to change role"); return; }
    toast.success(`Role updated to ${newRole}`);
    setChangeRoleUser(null);
    fetchAll();
  };

  const setBan = async (userId: string, banned: boolean, reason?: string) => {
    const { error } = await supabase.rpc("admin_set_ban" as any, {
      _user_id: userId,
      _banned: banned,
      _reason: reason || null,
    });
    if (error) { toast.error(`Failed: ${error.message}`); return; }
    toast.success(banned ? "User banned permanently" : "User unbanned");
    setBanUser(null);
    fetchAll();
  };

  const overrideJobStatus = async (jobId: string, newStatus: string, reason?: string) => {
    const { error } = await supabase.rpc("admin_override_job" as any, {
      _job_id: jobId,
      _new_status: newStatus,
      _reason: reason || null,
    });
    if (error) { toast.error(`Failed: ${error.message}`); return; }
    toast.success(`Job status set to ${newStatus}`);
    setOverrideJob(null);
    fetchAll();
  };

  const adjustWallet = async (userId: string, amount: number, reason: string) => {
    const { data, error } = await supabase.rpc("admin_adjust_wallet" as any, {
      _user_id: userId,
      _amount: amount,
      _reason: reason,
    });
    if (error) { toast.error(`Failed: ${error.message}`); return; }
    toast.success(`Wallet adjusted. New balance: $${Number(data).toFixed(2)}`);
    setWalletUser(null);
    fetchAll();
  };

  const overrideSubscription = async (userId: string, action: string, days?: number, reason?: string) => {
    const { error } = await supabase.rpc("admin_override_subscription" as any, {
      _user_id: userId,
      _action: action,
      _days: days || null,
      _reason: reason || null,
    });
    if (error) { toast.error(`Failed: ${error.message}`); return; }
    toast.success("Subscription updated");
    setSubOverrideUser(null);
    fetchAll();
  };

  const moderateReview = async (reviewId: string, action: "hide" | "unhide" | "delete", reason?: string) => {
    const { error } = await supabase.rpc("admin_moderate_review" as any, {
      _review_id: reviewId,
      _action: action,
      _reason: reason || null,
    });
    if (error) { toast.error(`Failed: ${error.message}`); return; }
    const labels: Record<string, string> = { hide: "Review hidden", unhide: "Review restored", delete: "Review deleted" };
    toast.success(labels[action]);
    fetchAll();
  };

  const sendBroadcast = async (filter: string, title: string, message: string, link?: string) => {
    const { data, error } = await supabase.rpc("admin_broadcast_notification" as any, {
      _filter: filter,
      _title: title,
      _message: message,
      _type: "admin_broadcast",
      _link: link || null,
    });
    if (error) { toast.error(`Failed: ${error.message}`); return; }
    toast.success(`Broadcast sent to ${data} user${Number(data) === 1 ? "" : "s"}`);
    setBroadcastOpen(false);
  };

  const upsertSetting = async (key: string, value: any, description?: string) => {
    const { error } = await supabase.rpc("admin_upsert_app_setting" as any, {
      _key: key,
      _value: value,
      _description: description || null,
    });
    if (error) { toast.error(`Failed: ${error.message}`); return; }
    toast.success(`Setting "${key}" saved`);
    setEditSetting(null);
    fetchAll();
  };

  const deleteSetting = async (key: string) => {
    if (!confirm(`Delete setting "${key}"? This may break feature flags.`)) return;
    const { error } = await supabase.rpc("admin_delete_app_setting" as any, { _key: key });
    if (error) { toast.error(`Failed: ${error.message}`); return; }
    toast.success(`Setting "${key}" deleted`);
    fetchAll();
  };

  const resetUserViolations = async (userId: string, userName: string) => {
    if (!confirm(`Clear ALL violations for ${userName}? Score resets to 0 and visibility penalty to 1.0.`)) return;
    const { data, error } = await supabase.rpc("admin_reset_violations" as any, {
      _user_id: userId,
      _reason: null,
    });
    if (error) { toast.error(`Failed: ${error.message}`); return; }
    toast.success(`Cleared ${data} violation${Number(data) === 1 ? "" : "s"}`);
    fetchAll();
  };

  const removeTeamMember = async (memberId: string) => {
    if (!confirm("Remove this team member? They'll lose access to the team.")) return;
    const { error } = await supabase.rpc("admin_remove_team_member" as any, { _member_id: memberId });
    if (error) { toast.error(`Failed: ${error.message}`); return; }
    toast.success("Team member removed");
    fetchAll();
  };

  const cancelTeamInvite = async (inviteId: string) => {
    const { error } = await supabase.rpc("admin_cancel_team_invite" as any, { _invite_id: inviteId });
    if (error) { toast.error(`Failed: ${error.message}`); return; }
    toast.success("Invite cancelled");
    fetchAll();
  };

  const changeUserPlan = async (userId: string, newPlan: "free" | "premium" | "pro") => {
    const update: any = {
      plan_tier: newPlan,
      is_premium: newPlan !== "free",
      premium_status: newPlan === "free" ? "free" : "active",
    };
    const { error } = await supabase.from("profiles").update(update).eq("id", userId);
    if (error) { toast.error("Failed to change plan"); return; }
    toast.success(`Plan updated to ${newPlan}`);
    setChangePlanUser(null);
    fetchAll();
  };

  // Filter users (exclude admins always)
  const filteredUsers = useMemo(() => {
    return users.filter((u: any) => {
      if (u.role === "admin") return false;
      if (roleFilter !== "all") {
        if (roleFilter === "owner" && u.role !== "owner") return false;
        if (roleFilter === "cleaner" && !(u.role === "cleaner" && (u.worker_type || "cleaner") === "cleaner")) return false;
        if (roleFilter === "helper" && !(u.role === "cleaner" && u.worker_type === "helper")) return false;
      }
      if (statusFilter !== "all") {
        const isSuspended = u.suspension_until && new Date(u.suspension_until) > new Date();
        if (statusFilter === "suspended" && !isSuspended) return false;
        if (statusFilter === "banned" && !u.is_banned) return false;
        if (statusFilter === "verified" && u.identity_status !== "approved") return false;
        if (statusFilter === "pending" && u.identity_status !== "pending") return false;
        if (statusFilter === "unverified" && !["unverified", "rejected", null, undefined].includes(u.identity_status)) return false;
      }
      if (userSearch.trim()) {
        const q = userSearch.toLowerCase();
        if (
          !(u.full_name || "").toLowerCase().includes(q) &&
          !(u.email || "").toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [users, userSearch, roleFilter, statusFilter]);

  // Revenue calculations
  const completedJobs = useMemo(() => jobs.filter((j: any) => j.status === "completed"), [jobs]);
  const revenueData = useMemo(() => {
    const now = Date.now();
    const days = revenueRange === "all" ? null : parseInt(revenueRange);
    const cutoff = days ? now - days * 24 * 60 * 60 * 1000 : 0;
    const filtered = completedJobs.filter((j: any) => new Date(j.created_at).getTime() >= cutoff);
    const total = filtered.reduce((s: number, j: any) => s + Number(j.platform_fee || 0), 0);

    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
    const weekRev = completedJobs.filter((j: any) => new Date(j.created_at).getTime() >= weekAgo)
      .reduce((s: number, j: any) => s + Number(j.platform_fee || 0), 0);
    const monthRev = completedJobs.filter((j: any) => new Date(j.created_at).getTime() >= monthAgo)
      .reduce((s: number, j: any) => s + Number(j.platform_fee || 0), 0);
    const allTime = completedJobs.reduce((s: number, j: any) => s + Number(j.platform_fee || 0), 0);

    // Aggregate per day for chart
    const dayMap = new Map<string, number>();
    const chartDays = days || 30;
    for (let i = chartDays - 1; i >= 0; i--) {
      const d = new Date(now - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(5, 10); // MM-DD
      dayMap.set(key, 0);
    }
    filtered.forEach((j: any) => {
      const d = new Date(j.created_at);
      const key = d.toISOString().slice(5, 10);
      if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) || 0) + Number(j.platform_fee || 0));
    });
    const chart = Array.from(dayMap.entries()).map(([date, revenue]) => ({ date, revenue: Number(revenue.toFixed(2)) }));

    return { transactions: filtered, total, weekRev, monthRev, allTime, chart };
  }, [completedJobs, revenueRange]);

  const tabs: { key: Tab; label: string; icon: any; badge?: number }[] = [
    { key: "metrics", label: "Metrics", icon: BarChart3 },
    { key: "revenue", label: "Revenue", icon: TrendingUp },
    { key: "users", label: "Users", icon: Users },
    { key: "identity", label: "Identity", icon: ShieldCheck, badge: pendingIdentity.length },
    { key: "jobs", label: "Jobs", icon: Briefcase },
    { key: "disputes", label: "Disputes", icon: AlertTriangle, badge: stats.openDisputes },
    { key: "reviews", label: "Reviews", icon: Star, badge: reviews.filter((r: any) => !r.is_hidden).length > 0 ? undefined : 0 },
    { key: "violations", label: "Violations", icon: AlertOctagon, badge: users.filter((u: any) => (u.violation_score || 0) > 0).length },
    { key: "teams", label: "Teams", icon: UsersRound },
    { key: "settings", label: "Settings", icon: Settings },
    { key: "webhooks", label: "Webhooks", icon: Webhook, badge: webhookEvents.filter((w: any) => w.error || !w.processed_at).length },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h1 className="font-bold text-foreground">Shinely Admin</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout}>Logout</Button>
      </div>

      {/* Tab bar */}
      <div className="bg-card border-b border-border px-2 overflow-x-auto sticky top-0 z-10">
        <div className="flex gap-1 min-w-max">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors border-b-2 relative ${
                tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="w-3.5 h-3.5" /> {t.label}
              {!!t.badge && t.badge > 0 && (
                <span className="ml-1 px-1.5 min-w-[18px] h-[18px] inline-flex items-center justify-center text-[10px] font-bold rounded-full bg-destructive text-destructive-foreground">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 max-w-5xl mx-auto">
        {/* ─── METRICS ─── */}
        {tab === "metrics" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-foreground">Platform Metrics</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Total Users", value: stats.users, icon: Users, color: "text-primary" },
                { label: "Cleaners", value: stats.cleaners, icon: Users, color: "text-purple-500" },
                { label: "Owners", value: stats.owners, icon: Users, color: "text-blue-500" },
                { label: "Premium", value: stats.premiumUsers, icon: Crown, color: "text-amber-500" },
                { label: "Total Jobs", value: stats.jobs, icon: Briefcase, color: "text-emerald-500" },
                { label: "Active Jobs", value: stats.activeJobs, icon: Briefcase, color: "text-amber-500" },
                { label: "Completed", value: stats.completedJobs, icon: Briefcase, color: "text-green-500" },
                { label: "Platform Revenue", value: `$${stats.totalRevenue.toFixed(2)}`, icon: DollarSign, color: "text-emerald-600" },
              ].map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-card rounded-xl shadow-card p-4"
                >
                  <s.icon className={`w-5 h-5 ${s.color} mb-2`} />
                  <p className="text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* ─── REVENUE ─── */}
        {tab === "revenue" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-foreground">Revenue</h2>
              <Select value={revenueRange} onValueChange={(v) => setRevenueRange(v as RevenueRange)}>
                <SelectTrigger className="w-32 h-9 rounded-lg text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "All Time", value: revenueData.allTime, color: "text-emerald-600" },
                { label: "This Month", value: revenueData.monthRev, color: "text-primary" },
                { label: "This Week", value: revenueData.weekRev, color: "text-amber-600" },
                { label: "Selected Range", value: revenueData.total, color: "text-blue-600" },
              ].map((s, i) => (
                <div key={i} className="bg-card rounded-xl shadow-card p-4">
                  <DollarSign className={`w-5 h-5 ${s.color} mb-2`} />
                  <p className="text-2xl font-bold text-foreground">${s.value.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="bg-card rounded-xl shadow-card p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Revenue per day</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueData.chart} margin={{ top: 5, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(v: any) => [`$${v}`, "Revenue"]}
                    />
                    <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">
                Transactions ({revenueData.transactions.length})
              </h3>
              <div className="space-y-2">
                {revenueData.transactions.length === 0 && (
                  <p className="text-muted-foreground text-sm text-center py-6">No transactions in this range.</p>
                )}
                {revenueData.transactions.map((j: any) => {
                  const owner = users.find((u: any) => u.id === j.owner_id);
                  const cleaner = users.find((u: any) => u.id === j.hired_cleaner_id);
                  return (
                    <div key={j.id} className="bg-card rounded-xl shadow-card p-3">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <p className="text-sm font-medium text-foreground truncate flex-1">{j.title}</p>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {new Date(j.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground font-mono truncate mb-1.5">#{j.id.slice(0, 8)}</p>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="truncate">👤 {owner?.full_name || owner?.email || "—"}</span>
                        <span className="truncate">🧹 {cleaner?.full_name || cleaner?.email || "—"}</span>
                        <span>💰 Total: ${Number(j.total_amount || j.price || 0).toFixed(2)}</span>
                        <span className="text-emerald-600">🏷 Fee: ${Number(j.platform_fee || 0).toFixed(2)}</span>
                        <span className="col-span-2">🧽 Cleaner earned: ${Number(j.cleaner_earnings || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ─── USERS ─── */}
        {tab === "users" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-foreground">User Management</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{filteredUsers.length} of {users.filter((u: any) => u.role !== "admin").length}</span>
                <Button size="sm" onClick={() => setBroadcastOpen(true)} className="h-8 text-xs bg-primary text-primary-foreground">
                  <Megaphone className="w-3 h-3 mr-1" /> Broadcast
                </Button>
              </div>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or email…"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-9 rounded-xl h-10"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as RoleFilter)}>
                <SelectTrigger className="h-9 rounded-lg text-xs">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  <SelectItem value="owner">Owners</SelectItem>
                  <SelectItem value="cleaner">Cleaners</SelectItem>
                  <SelectItem value="helper">Helpers</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger className="h-9 rounded-lg text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="pending">Pending ID</SelectItem>
                  <SelectItem value="unverified">Unverified</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="banned">Banned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              {filteredUsers.map((u: any) => {
                const isSuspended = u.suspension_until && new Date(u.suspension_until) > new Date();
                const planLabel = u.is_premium ? (u.plan_tier === "pro" ? "Pro" : "Premium") : "Free";
                const displayRole = u.role === "cleaner" && u.worker_type === "helper" ? "helper" : u.role;
                return (
                  <div key={u.id} className="bg-card rounded-xl shadow-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{u.full_name || "Unnamed"}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <Badge variant="outline" className="text-[10px] capitalize">{displayRole}</Badge>
                          <Badge className={`text-[10px] border-0 ${u.is_premium ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"}`}>
                            {planLabel}
                          </Badge>
                          <IdentityBadge status={u.identity_status} />
                          {isSuspended && (
                            <Badge className="bg-destructive/10 text-destructive border-0 text-[10px]">Suspended</Badge>
                          )}
                          {u.is_banned && (
                            <Badge className="bg-destructive text-destructive-foreground border-0 text-[10px]">Banned</Badge>
                          )}
                          <Badge variant="outline" className="text-[10px]">
                            💰 ${Number(u.wallet_balance || 0).toFixed(2)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 mt-3">
                      <Button size="sm" variant="outline" onClick={() => setViewUser(u)} className="h-8 text-[11px]">
                        <Eye className="w-3 h-3 mr-1" /> View Profile
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setChangeRoleUser(u)} className="h-8 text-[11px]">
                        Change Role
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setWalletUser(u)} className="h-8 text-[11px]">
                        <Wallet className="w-3 h-3 mr-1" /> Adjust Wallet
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setSubOverrideUser(u)} className="h-8 text-[11px]">
                        <Crown className="w-3 h-3 mr-1" /> Subscription
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setChangePlanUser(u)} className="h-8 text-[11px]">
                        Change Plan
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleSuspend(u)}
                        disabled={u.is_banned}
                        className={`h-8 text-[11px] ${isSuspended ? "text-emerald-600 border-emerald-300 hover:bg-emerald-50" : "text-amber-700 border-amber-300 hover:bg-amber-50"}`}
                      >
                        {isSuspended ? (<><RotateCcw className="w-3 h-3 mr-1" /> Unsuspend</>) : (<><Ban className="w-3 h-3 mr-1" /> Suspend 30d</>)}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setBanUser(u)}
                        className={`h-8 text-[11px] col-span-2 ${u.is_banned ? "text-emerald-600 border-emerald-300 hover:bg-emerald-50" : "text-destructive border-destructive/40 hover:bg-destructive/5"}`}
                      >
                        {u.is_banned ? (<><RotateCcw className="w-3 h-3 mr-1" /> Unban (Permanent)</>) : (<><ShieldOff className="w-3 h-3 mr-1" /> Ban Permanently</>)}
                      </Button>
                    </div>
                  </div>
                );
              })}
              {filteredUsers.length === 0 && (
                <p className="text-muted-foreground text-sm text-center py-8">No users found.</p>
              )}
            </div>
          </div>
        )}

        {/* ─── IDENTITY ─── */}
        {tab === "identity" && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Identity Verification ({pendingIdentity.length} pending)
            </h2>
            {pendingIdentity.length === 0 ? (
              <p className="text-muted-foreground text-sm">No pending identity verifications.</p>
            ) : (
              pendingIdentity.map((u: any) => (
                <IdentityReviewCard key={u.id} user={u} getSignedUrl={getSignedDocUrl} onDecide={reviewIdentity} />
              ))
            )}
          </div>
        )}

        {/* ─── JOBS ─── */}
        {tab === "jobs" && (
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-foreground mb-3">Jobs Management</h2>
            {jobs.map((j: any) => {
              const owner = users.find((u: any) => u.id === j.owner_id);
              const cleaner = users.find((u: any) => u.id === j.hired_cleaner_id);
              return (
                <div key={j.id} className="bg-card rounded-xl shadow-card p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground flex-1 truncate">{j.title}</p>
                    <Badge variant="outline" className="text-[10px] capitalize flex-shrink-0">{j.status}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>💰 ${Number(j.price).toFixed(2)}</span>
                    <span>🏷 Fee: ${Number(j.platform_fee || 0).toFixed(2)}</span>
                    <span className="truncate">👤 Owner: {owner?.full_name || owner?.email || "—"}</span>
                    <span className="truncate">🧹 Cleaner: {cleaner?.full_name || cleaner?.email || "—"}</span>
                    <span>📍 {j.city || "N/A"}</span>
                    <span>📅 {new Date(j.created_at).toLocaleDateString()}</span>
                    <span className="col-span-2 text-[10px]">🔒 Escrow: <span className="font-mono">{j.escrow_status}</span> · ID: <span className="font-mono">{j.id.slice(0, 8)}</span></span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setOverrideJob(j)}
                    className="h-8 text-[11px] w-full mt-1"
                  >
                    <Settings2 className="w-3 h-3 mr-1" /> Override Status
                  </Button>
                </div>
              );
            })}
            {jobs.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-8">No jobs yet.</p>
            )}
          </div>
        )}

        {/* ─── DISPUTES ─── */}
        {tab === "disputes" && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Open Disputes ({disputes.filter((d: any) => d.status === "open").length})
            </h2>
            {disputes.length === 0 && (
              <p className="text-muted-foreground text-sm">No disputes.</p>
            )}
            {disputes.map((d: any) => (
              <DisputeCard
                key={d.id}
                dispute={d}
                users={users}
                jobs={jobs}
                onResolved={fetchAll}
              />
            ))}
          </div>
        )}

        {/* ─── REVIEWS ─── */}
        {tab === "reviews" && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500" />
              Reviews ({reviews.length})
            </h2>
            <p className="text-xs text-muted-foreground">
              Hide a review to remove it from public profiles and rating averages. Delete only for spam/abuse.
            </p>
            {reviews.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-8">No reviews yet.</p>
            )}
            {reviews.map((r: any) => {
              const reviewer = users.find((u: any) => u.id === r.reviewer_id);
              const reviewed = users.find((u: any) => u.id === r.reviewed_id);
              const job = jobs.find((j: any) => j.id === r.job_id);
              return (
                <div key={r.id} className={`bg-card rounded-xl shadow-card p-3 space-y-2 ${r.is_hidden ? "opacity-60 border border-amber-300" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex">
                          {[1,2,3,4,5].map(n => (
                            <Star key={n} className={`w-3.5 h-3.5 ${n <= r.rating ? "text-amber-500 fill-amber-500" : "text-muted-foreground/30"}`} />
                          ))}
                        </div>
                        <Badge variant="outline" className="text-[10px] capitalize">{r.reviewer_role}</Badge>
                        {r.is_hidden && (
                          <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px]">Hidden</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{reviewer?.full_name || reviewer?.email || "—"}</span>
                        {" → "}
                        <span className="font-medium text-foreground">{reviewed?.full_name || reviewed?.email || "—"}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {job?.title || "—"} · {new Date(r.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {r.comment && (
                    <p className="text-xs text-foreground bg-muted/40 rounded-lg p-2 whitespace-pre-wrap">{r.comment}</p>
                  )}
                  {r.is_hidden && r.hidden_reason && (
                    <p className="text-[10px] text-amber-700 bg-amber-50 rounded-lg p-2">
                      <strong>Hidden reason:</strong> {r.hidden_reason}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-1.5">
                    {r.is_hidden ? (
                      <Button size="sm" variant="outline" onClick={() => moderateReview(r.id, "unhide")} className="h-8 text-[11px] text-emerald-600 border-emerald-300 hover:bg-emerald-50">
                        <RotateCcw className="w-3 h-3 mr-1" /> Unhide
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const reason = prompt("Reason for hiding (optional, visible to admins only):");
                          if (reason !== null) moderateReview(r.id, "hide", reason || undefined);
                        }}
                        className="h-8 text-[11px] text-amber-700 border-amber-300 hover:bg-amber-50"
                      >
                        <EyeOff className="w-3 h-3 mr-1" /> Hide
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (confirm("Permanently delete this review? This cannot be undone.")) {
                          moderateReview(r.id, "delete");
                        }
                      }}
                      className="h-8 text-[11px] text-destructive border-destructive/40 hover:bg-destructive/5"
                    >
                      <Trash2 className="w-3 h-3 mr-1" /> Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── VIOLATIONS ─── */}
        {tab === "violations" && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <AlertOctagon className="w-5 h-5 text-destructive" />
              Platform Violations
            </h2>
            <p className="text-xs text-muted-foreground">
              Users with violation_score &gt; 0. Each violation can be triggered automatically (chat profanity, spam, etc.) and reduces the user's visibility in search.
            </p>
            {users.filter((u: any) => (u.violation_score || 0) > 0).length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-8">No users with violations.</p>
            )}
            {users
              .filter((u: any) => (u.violation_score || 0) > 0)
              .sort((a: any, b: any) => (b.violation_score || 0) - (a.violation_score || 0))
              .map((u: any) => {
                const userViolations = violations.filter((v: any) => v.user_id === u.id);
                return (
                  <div key={u.id} className="bg-card rounded-xl shadow-card p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{u.full_name || u.email}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-2xl font-bold text-destructive">{u.violation_score || 0}</p>
                        <p className="text-[10px] text-muted-foreground">score</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-muted/40 rounded-lg p-2">
                        <p className="text-[10px] text-muted-foreground">Visibility</p>
                        <p className="text-foreground">{Math.round(Number(u.visibility_penalty || 1) * 100)}%</p>
                      </div>
                      <div className="bg-muted/40 rounded-lg p-2">
                        <p className="text-[10px] text-muted-foreground">Total events</p>
                        <p className="text-foreground">{userViolations.length}</p>
                      </div>
                    </div>
                    {userViolations.slice(0, 3).map((v: any) => (
                      <div key={v.id} className="text-[11px] bg-muted/30 rounded p-2">
                        <p className="font-medium text-foreground">{v.violation_type} <span className="text-muted-foreground">· {v.context}</span></p>
                        {v.message_snippet && <p className="text-muted-foreground italic mt-0.5">"{v.message_snippet}"</p>}
                        <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(v.created_at).toLocaleString()}</p>
                      </div>
                    ))}
                    {userViolations.length > 3 && (
                      <p className="text-[10px] text-muted-foreground text-center">+ {userViolations.length - 3} older violation{userViolations.length - 3 === 1 ? "" : "s"}</p>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resetUserViolations(u.id, u.full_name || u.email)}
                      className="h-8 w-full text-[11px] text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                    >
                      <RotateCcw className="w-3 h-3 mr-1" /> Clear All Violations
                    </Button>
                  </div>
                );
              })}
          </div>
        )}

        {/* ─── TEAMS ─── */}
        {tab === "teams" && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <UsersRound className="w-5 h-5 text-primary" />
              Teams ({teamMembers.length} members · {teamInvites.filter((i: any) => i.status === "pending").length} pending)
            </h2>
            {teamMembers.length === 0 && teamInvites.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-8">No teams yet.</p>
            )}
            {teamMembers.length > 0 && (
              <>
                <h3 className="text-sm font-semibold text-foreground mt-2">Active Members</h3>
                {teamMembers.map((m: any) => {
                  const owner = users.find((u: any) => u.id === m.team_owner_id);
                  const member = users.find((u: any) => u.id === m.member_id);
                  return (
                    <div key={m.id} className="bg-card rounded-xl shadow-card p-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">
                            {member?.full_name || member?.email || "—"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            Team of {owner?.full_name || owner?.email || "—"}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px] capitalize flex-shrink-0">{m.role}</Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Joined: {new Date(m.joined_at).toLocaleDateString()}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => removeTeamMember(m.id)}
                        className="h-8 w-full text-[11px] text-destructive border-destructive/40 hover:bg-destructive/5"
                      >
                        <Trash2 className="w-3 h-3 mr-1" /> Remove from Team
                      </Button>
                    </div>
                  );
                })}
              </>
            )}
            {teamInvites.length > 0 && (
              <>
                <h3 className="text-sm font-semibold text-foreground mt-4">Invites</h3>
                {teamInvites.map((i: any) => {
                  const owner = users.find((u: any) => u.id === i.team_owner_id);
                  const invitee = i.invitee_id ? users.find((u: any) => u.id === i.invitee_id) : null;
                  const statusColor = i.status === "pending" ? "bg-amber-100 text-amber-700" : i.status === "accepted" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground";
                  return (
                    <div key={i.id} className="bg-card rounded-xl shadow-card p-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">
                            {invitee?.full_name || invitee?.email || i.email || "—"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            From {owner?.full_name || owner?.email || "—"}
                          </p>
                        </div>
                        <Badge className={`${statusColor} border-0 text-[10px] flex-shrink-0`}>{i.status}</Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Sent: {new Date(i.created_at).toLocaleString()}</p>
                      {i.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => cancelTeamInvite(i.id)}
                          className="h-8 w-full text-[11px] text-destructive border-destructive/40 hover:bg-destructive/5"
                        >
                          <X className="w-3 h-3 mr-1" /> Cancel Invite
                        </Button>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* ─── SETTINGS ─── */}
        {tab === "settings" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                App Settings ({appSettings.length})
              </h2>
              <Button size="sm" onClick={() => setEditSetting({ key: "", value: {}, description: "" })} className="h-8 text-xs bg-primary text-primary-foreground">
                <Plus className="w-3 h-3 mr-1" /> New
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Feature flags and platform-wide configuration. Values are JSON. Editing affects the live app immediately.
            </p>
            {appSettings.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-8">No settings yet.</p>
            )}
            {appSettings.map((s: any) => (
              <div key={s.key} className="bg-card rounded-xl shadow-card p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-mono font-medium text-foreground">{s.key}</p>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">
                    {new Date(s.updated_at).toLocaleDateString()}
                  </span>
                </div>
                {s.description && (
                  <p className="text-xs text-muted-foreground">{s.description}</p>
                )}
                <pre className="text-[11px] bg-muted/40 rounded-lg p-2 overflow-x-auto font-mono whitespace-pre-wrap break-all">{JSON.stringify(s.value, null, 2)}</pre>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => setEditSetting(s)} className="h-8 text-[11px]">
                    <Settings2 className="w-3 h-3 mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => deleteSetting(s.key)} className="h-8 text-[11px] text-destructive border-destructive/40 hover:bg-destructive/5">
                    <Trash2 className="w-3 h-3 mr-1" /> Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ─── WEBHOOKS ─── */}
        {tab === "webhooks" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Webhook className="w-5 h-5 text-primary" />
                Webhook Events ({webhookEvents.length})
              </h2>
              <Button size="sm" variant="outline" onClick={fetchAll} className="h-8 text-xs">
                <RotateCcw className="w-3 h-3 mr-1" /> Refresh
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Last 100 Stripe webhook events received. Use this to debug payment / subscription issues.
            </p>
            {webhookEvents.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-8">No webhook events recorded yet.</p>
            )}
            {webhookEvents.map((w: any) => {
              const status = w.error
                ? { label: "Error", color: "bg-destructive/10 text-destructive" }
                : w.processed_at
                ? { label: "Processed", color: "bg-emerald-100 text-emerald-700" }
                : { label: "Pending", color: "bg-amber-100 text-amber-700" };
              return (
                <div key={w.id} className="bg-card rounded-xl shadow-card p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground truncate font-mono">{w.event_type}</p>
                    <Badge className={`${status.color} border-0 text-[10px] flex-shrink-0`}>{status.label}</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono truncate">{w.stripe_event_id}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Received: {new Date(w.created_at).toLocaleString()}
                    {w.processed_at && ` · Processed: ${new Date(w.processed_at).toLocaleString()}`}
                  </p>
                  {w.error && (
                    <p className="text-xs text-destructive bg-destructive/5 rounded p-2 mt-1 break-words">{w.error}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* View Profile Modal */}
      <UserProfileModal user={viewUser} onClose={() => setViewUser(null)} />

      {/* Change Role Modal */}
      <ChangeRoleModal
        user={changeRoleUser}
        onClose={() => setChangeRoleUser(null)}
        onConfirm={changeUserRole}
      />

      {/* Change Plan Modal */}
      <ChangePlanModal
        user={changePlanUser}
        onClose={() => setChangePlanUser(null)}
        onConfirm={changeUserPlan}
      />

      {/* Ban Modal */}
      <BanModal
        user={banUser}
        onClose={() => setBanUser(null)}
        onConfirm={setBan}
      />

      {/* Job Override Modal */}
      <OverrideJobModal
        job={overrideJob}
        onClose={() => setOverrideJob(null)}
        onConfirm={overrideJobStatus}
      />

      {/* Wallet Adjust Modal */}
      <WalletAdjustModal
        user={walletUser}
        onClose={() => setWalletUser(null)}
        onConfirm={adjustWallet}
      />

      {/* Subscription Override Modal */}
      <SubscriptionOverrideModal
        user={subOverrideUser}
        onClose={() => setSubOverrideUser(null)}
        onConfirm={overrideSubscription}
      />

      {/* Broadcast Modal */}
      <BroadcastModal
        open={broadcastOpen}
        onClose={() => setBroadcastOpen(false)}
        onConfirm={sendBroadcast}
      />

      {/* App Setting Edit Modal */}
      <SettingEditModal
        setting={editSetting}
        onClose={() => setEditSetting(null)}
        onConfirm={upsertSetting}
      />
    </div>
  );
}

/* ───────── Helpers / sub-components ───────── */

function IdentityBadge({ status }: { status?: string }) {
  const s = status || "unverified";
  if (s === "approved") return <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px]">Verified</Badge>;
  if (s === "pending") return <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px]">Pending ID</Badge>;
  if (s === "rejected") return <Badge className="bg-destructive/10 text-destructive border-0 text-[10px]">ID Rejected</Badge>;
  return <Badge variant="outline" className="text-[10px]">Unverified</Badge>;
}

function UserProfileModal({ user, onClose }: { user: any | null; onClose: () => void }) {
  if (!user) return null;
  const fields: { label: string; value: any }[] = [
    { label: "Full Name", value: user.full_name },
    { label: "Email", value: user.email },
    { label: "Phone", value: user.phone },
    { label: "City", value: user.city },
    { label: "Role", value: user.role },
    { label: "Worker Type", value: user.worker_type },
    { label: "Plan Tier", value: user.plan_tier },
    { label: "Is Premium", value: user.is_premium ? "Yes" : "No" },
    { label: "Identity Status", value: user.identity_status },
    { label: "Jobs Completed", value: user.jobs_completed ?? 0 },
    { label: "Total Earnings", value: `$${Number(user.total_earnings || 0).toFixed(2)}` },
    { label: "Points", value: user.points ?? 0 },
    { label: "Languages", value: (user.languages || []).join(", ") || "—" },
    { label: "Specialties", value: (user.specialties || []).join(", ") || "—" },
    { label: "Regions", value: (user.regions || []).join(", ") || "—" },
    { label: "Experience (yrs)", value: user.experience_years ?? 0 },
    { label: "Years in Business", value: user.years_in_business ?? 0 },
    { label: "Company Name", value: user.company_name },
    { label: "Has Transportation", value: user.has_transportation ? "Yes" : "No" },
    { label: "Available Now", value: user.is_available_now ? "Yes" : "No" },
    { label: "Cancellations", value: user.cancellation_violations ?? 0 },
    { label: "Violation Score", value: user.violation_score ?? 0 },
    { label: "Suspension Until", value: user.suspension_until ? new Date(user.suspension_until).toLocaleString() : "—" },
    { label: "Joined", value: new Date(user.created_at).toLocaleString() },
  ];

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {user.avatar_url && (
              <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
            )}
            {user.full_name || "Unnamed"}
          </DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>
        {user.bio && (
          <div className="bg-muted/40 rounded-lg p-3 text-xs text-foreground">{user.bio}</div>
        )}
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          {fields.map((f, i) => (
            <div key={i}>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{f.label}</p>
              <p className="text-foreground break-words">{f.value || "—"}</p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ChangeRoleModal({
  user, onClose, onConfirm,
}: {
  user: any | null;
  onClose: () => void;
  onConfirm: (id: string, role: "cleaner" | "owner" | "admin") => void;
}) {
  const [selected, setSelected] = useState<string>("");
  useEffect(() => { if (user) setSelected(user.role); }, [user]);
  if (!user) return null;
  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Change Role</DialogTitle>
          <DialogDescription>{user.full_name || user.email}</DialogDescription>
        </DialogHeader>
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="h-10 rounded-lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cleaner">Cleaner</SelectItem>
            <SelectItem value="owner">Owner</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button
            onClick={() => onConfirm(user.id, selected as any)}
            disabled={selected === user.role}
            className="flex-1 bg-primary text-primary-foreground"
          >
            Update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChangePlanModal({
  user, onClose, onConfirm,
}: {
  user: any | null;
  onClose: () => void;
  onConfirm: (id: string, plan: "free" | "premium" | "pro") => void;
}) {
  const [selected, setSelected] = useState<string>("");
  useEffect(() => { if (user) setSelected(user.plan_tier || "free"); }, [user]);
  if (!user) return null;
  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Change Plan</DialogTitle>
          <DialogDescription>{user.full_name || user.email}</DialogDescription>
        </DialogHeader>
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="h-10 rounded-lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="premium">Premium</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
          </SelectContent>
        </Select>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button
            onClick={() => onConfirm(user.id, selected as any)}
            disabled={selected === (user.plan_tier || "free")}
            className="flex-1 bg-primary text-primary-foreground"
          >
            Update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IdentityReviewCard({
  user, getSignedUrl, onDecide,
}: {
  user: any;
  getSignedUrl: (p: string | null) => Promise<string | null>;
  onDecide: (id: string, d: "approved" | "rejected", reason?: string) => void;
}) {
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [addressUrl, setAddressUrl] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const isOwner = user.role === "owner";
  const workerType = user.worker_type || "cleaner";
  const roleLabel = isOwner ? "Owner" : workerType === "helper" ? "Helper" : "Cleaner";
  const roleBadgeClass = isOwner
    ? "bg-blue-100 text-blue-700"
    : workerType === "helper"
    ? "bg-purple-100 text-purple-700"
    : "bg-emerald-100 text-emerald-700";

  useEffect(() => {
    (async () => {
      setDocUrl(await getSignedUrl(user.identity_document_url));
      setSelfieUrl(await getSignedUrl(user.identity_selfie_url));
      setAddressUrl(await getSignedUrl(user.identity_address_proof_url));
    })();
  }, [user.id]);

  const handleReject = () => {
    onDecide(user.id, "rejected", rejectReason);
    setShowRejectModal(false);
    setRejectReason("");
  };

  return (
    <div className="bg-card rounded-xl shadow-card p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{user.full_name || "Unnamed"}</p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          {user.identity_submitted_at && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Submitted: {new Date(user.identity_submitted_at).toLocaleString()}
            </p>
          )}
        </div>
        <Badge className={`${roleBadgeClass} border-0 text-[10px] flex-shrink-0`}>{roleLabel}</Badge>
      </div>
      <div className={`grid ${isOwner ? "grid-cols-3" : "grid-cols-2"} gap-2`}>
        <div>
          <p className="text-[10px] text-muted-foreground mb-1">📄 ID Document</p>
          {docUrl ? (
            <a href={docUrl} target="_blank" rel="noreferrer">
              <img src={docUrl} alt="Document" className="w-full aspect-square object-cover rounded-lg border border-border" />
            </a>
          ) : <div className="aspect-square bg-muted rounded-lg" />}
        </div>
        {isOwner && (
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">🏠 Proof of Address</p>
            {addressUrl ? (
              <a href={addressUrl} target="_blank" rel="noreferrer">
                <img src={addressUrl} alt="Proof of Address" className="w-full aspect-square object-cover rounded-lg border border-border" />
              </a>
            ) : <div className="aspect-square bg-muted rounded-lg" />}
          </div>
        )}
        <div>
          <p className="text-[10px] text-muted-foreground mb-1">🤳 Selfie {isOwner ? "with ID" : ""}</p>
          {selfieUrl ? (
            <a href={selfieUrl} target="_blank" rel="noreferrer">
              <img src={selfieUrl} alt="Selfie" className="w-full aspect-square object-cover rounded-lg border border-border" />
            </a>
          ) : <div className="aspect-square bg-muted rounded-lg" />}
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          onClick={() => onDecide(user.id, "approved")}
          className="flex-1 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
        >
          <Check className="w-3.5 h-3.5 mr-1" /> Approve
        </Button>
        <Button
          onClick={() => setShowRejectModal(true)}
          variant="outline"
          className="flex-1 h-9 rounded-lg text-destructive border-destructive/30 text-xs"
        >
          <X className="w-3.5 h-3.5 mr-1" /> Reject
        </Button>
      </div>

      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reject Identity</DialogTitle>
            <DialogDescription>
              Provide a reason — this helps the user know what to fix.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Document is blurry, selfie does not match ID…"
            className="rounded-lg text-sm min-h-[100px]"
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowRejectModal(false)} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={!rejectReason.trim()}
              className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DisputeCard({
  dispute, users, jobs, onResolved,
}: {
  dispute: any;
  users: any[];
  jobs: any[];
  onResolved: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const raisedBy = users.find((u: any) => u.id === dispute.raised_by);
  const against = users.find((u: any) => u.id === dispute.against);
  const job = jobs.find((j: any) => j.id === dispute.job_id);
  const isOpen = dispute.status === "open";

  const resolve = async (decision: "refund_owner" | "pay_cleaner" | "dismiss") => {
    setSaving(true);
    const { error } = await supabase.rpc("admin_resolve_dispute" as any, {
      _dispute_id: dispute.id,
      _decision: decision,
      _notes: notes || null,
    });
    setSaving(false);
    if (error) { toast.error(`Failed: ${error.message}`); return; }
    const labels: Record<string, string> = {
      refund_owner: "Refund issued to owner",
      pay_cleaner: "Cleaner paid",
      dismiss: "Dispute dismissed",
    };
    toast.success(labels[decision] || "Dispute resolved");
    onResolved();
  };

  const statusBadge = isOpen
    ? <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px]">Open</Badge>
    : <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px]">Resolved</Badge>;

  const jobAmount = Number(job?.total_amount || job?.price || 0);
  const cleanerAmount = Number(job?.cleaner_earnings || job?.price || 0);

  return (
    <div className="bg-card rounded-xl shadow-card p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">
            {job?.title || "Job"} · ${jobAmount.toFixed(2)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {new Date(dispute.created_at).toLocaleString()}
          </p>
        </div>
        {statusBadge}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-muted/40 rounded-lg p-2">
          <p className="text-[10px] text-muted-foreground">Raised by</p>
          <p className="text-foreground truncate">{raisedBy?.full_name || raisedBy?.email || "—"}</p>
        </div>
        <div className="bg-muted/40 rounded-lg p-2">
          <p className="text-[10px] text-muted-foreground">Against</p>
          <p className="text-foreground truncate">{against?.full_name || against?.email || "—"}</p>
        </div>
      </div>

      <div>
        <p className="text-[10px] text-muted-foreground mb-1">Reason</p>
        <p className="text-xs text-foreground bg-muted/40 rounded-lg p-2">{dispute.reason}</p>
      </div>

      {dispute.description && (
        <div>
          <p className="text-[10px] text-muted-foreground mb-1">Description</p>
          <p className="text-xs text-foreground bg-muted/40 rounded-lg p-2 whitespace-pre-wrap">{dispute.description}</p>
        </div>
      )}

      {isOpen ? (
        <>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Admin notes (optional)…"
            className="rounded-lg text-xs min-h-[60px]"
          />
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-[11px] text-amber-900">
            ⚠️ Resolving will <strong>execute payment</strong>: Refund Owner credits ${jobAmount.toFixed(2)} to owner's wallet · Pay Cleaner credits ${cleanerAmount.toFixed(2)} to cleaner's wallet · Dismiss closes without money movement.
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button
              size="sm"
              disabled={saving}
              onClick={() => resolve("refund_owner")}
              className="h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px]"
            >
              Refund Owner
            </Button>
            <Button
              size="sm"
              disabled={saving || !job?.hired_cleaner_id}
              onClick={() => resolve("pay_cleaner")}
              className="h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] disabled:opacity-50"
            >
              Pay Cleaner
            </Button>
            <Button
              size="sm"
              disabled={saving}
              variant="outline"
              onClick={() => resolve("dismiss")}
              className="h-9 rounded-lg text-[11px]"
            >
              Dismiss
            </Button>
          </div>
        </>
      ) : (
        <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-2">
          <p><span className="font-medium text-foreground">Resolution:</span> {dispute.resolution || "—"}</p>
          {dispute.resolved_at && (
            <p className="mt-1 text-[10px]">Resolved: {new Date(dispute.resolved_at).toLocaleString()}</p>
          )}
        </div>
      )}
    </div>
  );
}

function BanModal({
  user, onClose, onConfirm,
}: {
  user: any | null;
  onClose: () => void;
  onConfirm: (id: string, banned: boolean, reason?: string) => void;
}) {
  const [reason, setReason] = useState("");
  useEffect(() => { if (user) setReason(user.ban_reason || ""); }, [user]);
  if (!user) return null;
  const isCurrentlyBanned = !!user.is_banned;

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isCurrentlyBanned ? <RotateCcw className="w-4 h-4 text-emerald-600" /> : <ShieldOff className="w-4 h-4 text-destructive" />}
            {isCurrentlyBanned ? "Unban User" : "Ban User Permanently"}
          </DialogTitle>
          <DialogDescription>{user.full_name || user.email}</DialogDescription>
        </DialogHeader>

        {isCurrentlyBanned ? (
          <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-2">
            <p>Currently banned since {user.banned_at ? new Date(user.banned_at).toLocaleString() : "—"}.</p>
            {user.ban_reason && <p className="mt-1"><strong>Reason:</strong> {user.ban_reason}</p>}
            <p className="mt-2">Unbanning restores full account access.</p>
          </div>
        ) : (
          <>
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-2 text-[11px] text-destructive">
              ⚠️ Ban is permanent. The user will be blocked from logging in and using the platform until you unban them.
            </div>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (visible to admins only, e.g. 'repeated harassment, fraud, etc.')"
              className="rounded-lg text-xs min-h-[80px]"
            />
          </>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button
            onClick={() => onConfirm(user.id, !isCurrentlyBanned, reason || undefined)}
            disabled={!isCurrentlyBanned && !reason.trim()}
            className={`flex-1 ${isCurrentlyBanned ? "bg-emerald-600 hover:bg-emerald-700" : "bg-destructive hover:bg-destructive/90"} text-white`}
          >
            {isCurrentlyBanned ? "Unban" : "Ban Permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OverrideJobModal({
  job, onClose, onConfirm,
}: {
  job: any | null;
  onClose: () => void;
  onConfirm: (id: string, status: string, reason?: string) => void;
}) {
  const [status, setStatus] = useState("");
  const [reason, setReason] = useState("");
  useEffect(() => { if (job) { setStatus(job.status); setReason(""); } }, [job]);
  if (!job) return null;

  const STATUSES = ["open", "accepted", "in_progress", "pending_review", "completed", "cancelled", "refunded", "disputed"];

  return (
    <Dialog open={!!job} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-primary" />
            Override Job Status
          </DialogTitle>
          <DialogDescription>{job.title}</DialogDescription>
        </DialogHeader>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-[11px] text-amber-900">
          ⚠️ Force-changes the job status without normal validation. Use only when the job is stuck or for emergency intervention. <strong>Does NOT execute payment</strong> — use Disputes tab for refunds/payouts.
        </div>

        <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-2 space-y-1">
          <p><strong>Current status:</strong> <span className="font-mono">{job.status}</span></p>
          <p><strong>Escrow:</strong> <span className="font-mono">{job.escrow_status}</span></p>
          <p><strong>Job ID:</strong> <span className="font-mono">{job.id.slice(0, 8)}…</span></p>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">New status</p>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-10 rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (for audit log, optional)"
          className="rounded-lg text-xs min-h-[60px]"
        />

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button
            onClick={() => onConfirm(job.id, status, reason || undefined)}
            disabled={status === job.status}
            className="flex-1 bg-primary text-primary-foreground"
          >
            Force Status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WalletAdjustModal({
  user, onClose, onConfirm,
}: {
  user: any | null;
  onClose: () => void;
  onConfirm: (id: string, amount: number, reason: string) => void;
}) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [direction, setDirection] = useState<'credit' | 'debit'>('credit');
  useEffect(() => { if (user) { setAmount(''); setReason(''); setDirection('credit'); } }, [user]);
  if (!user) return null;
  const numAmount = parseFloat(amount) || 0;
  const signedAmount = direction === 'credit' ? numAmount : -numAmount;
  const newBalance = Number(user.wallet_balance || 0) + signedAmount;

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-primary" /> Adjust Wallet
          </DialogTitle>
          <DialogDescription>{user.full_name || user.email}</DialogDescription>
        </DialogHeader>
        <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-2">
          Current balance: <strong className="text-foreground">${Number(user.wallet_balance || 0).toFixed(2)}</strong>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={direction === 'credit' ? 'default' : 'outline'}
            onClick={() => setDirection('credit')}
            className={direction === 'credit' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : ''}
          >
            + Credit
          </Button>
          <Button
            type="button"
            variant={direction === 'debit' ? 'default' : 'outline'}
            onClick={() => setDirection('debit')}
            className={direction === 'debit' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
          >
            − Debit
          </Button>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Amount ($)</p>
          <Input type="number" step="0.01" min="0.01" placeholder="e.g. 25.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-10 rounded-lg" />
        </div>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required, logged in wallet_transactions)" className="rounded-lg text-xs min-h-[60px]" />
        {numAmount > 0 && (
          <div className={`text-xs rounded-lg p-2 ${newBalance < 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted/40 text-foreground'}`}>
            New balance: <strong>${newBalance.toFixed(2)}</strong>
            {newBalance < 0 && <p className="mt-1">⚠️ Insufficient balance for this debit.</p>}
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button
            onClick={() => onConfirm(user.id, signedAmount, reason)}
            disabled={numAmount <= 0 || !reason.trim() || newBalance < 0}
            className="flex-1 bg-primary text-primary-foreground"
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SubscriptionOverrideModal({
  user, onClose, onConfirm,
}: {
  user: any | null;
  onClose: () => void;
  onConfirm: (id: string, action: string, days?: number, reason?: string) => void;
}) {
  const [action, setAction] = useState<string>('grant_premium');
  const [days, setDays] = useState('7');
  const [reason, setReason] = useState('');
  useEffect(() => { if (user) { setAction('grant_premium'); setDays('7'); setReason(''); } }, [user]);
  if (!user) return null;

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-500" /> Subscription Override
          </DialogTitle>
          <DialogDescription>{user.full_name || user.email}</DialogDescription>
        </DialogHeader>
        <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-2 space-y-1">
          <p>Current plan: <strong className="text-foreground">{user.plan_tier}</strong> ({user.premium_status})</p>
          {user.free_trial_ends_at && (
            <p>Trial ends: <strong className="text-foreground">{new Date(user.free_trial_ends_at).toLocaleDateString()}</strong></p>
          )}
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-[11px] text-blue-900">
          ℹ️ This only changes the local database. If the user has a real Stripe subscription, manage that separately in the Stripe Dashboard.
        </div>
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="grant_premium">Grant Premium (free)</SelectItem>
            <SelectItem value="grant_pro">Grant Pro (free)</SelectItem>
            <SelectItem value="extend_trial">Extend Trial</SelectItem>
            <SelectItem value="revoke">Revoke (set to Free)</SelectItem>
          </SelectContent>
        </Select>
        {action === 'extend_trial' && (
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Trial days from now</p>
            <Input type="number" min="1" max="365" value={days} onChange={(e) => setDays(e.target.value)} className="h-10 rounded-lg" />
          </div>
        )}
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (audit log, optional)" className="rounded-lg text-xs min-h-[60px]" />
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button
            onClick={() => onConfirm(user.id, action, action === 'extend_trial' ? parseInt(days) : undefined, reason || undefined)}
            disabled={action === 'extend_trial' && (!days || parseInt(days) <= 0)}
            className="flex-1 bg-primary text-primary-foreground"
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function BroadcastModal({
  open, onClose, onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (filter: string, title: string, message: string, link?: string) => void;
}) {
  const [filter, setFilter] = useState("all");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  useEffect(() => { if (!open) { setFilter("all"); setTitle(""); setMessage(""); setLink(""); } }, [open]);

  const filterLabels: Record<string, string> = {
    all: "All users",
    "role:cleaner": "All cleaners",
    "role:owner": "All owners",
    "plan:free": "Free plan users",
    "plan:premium": "Premium subscribers",
    "plan:pro": "Pro subscribers",
    verified: "Identity-verified users",
    unverified: "Unverified users",
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-primary" /> Broadcast Notification
          </DialogTitle>
          <DialogDescription>Send an in-app notification to a cohort of users (banned excluded).</DialogDescription>
        </DialogHeader>

        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Audience</p>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(filterLabels).map(([k, label]) => (
                <SelectItem key={k} value={k}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Title</p>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="e.g. New feature: schedules!" className="h-10 rounded-lg" />
        </div>

        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Message</p>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} placeholder="What you want to announce…" className="rounded-lg text-sm min-h-[100px]" />
          <p className="text-[10px] text-muted-foreground mt-1 text-right">{message.length}/500</p>
        </div>

        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Link (optional)</p>
          <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="/jobs or https://..." className="h-10 rounded-lg" />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button
            onClick={() => onConfirm(filter, title, message, link || undefined)}
            disabled={!title.trim() || !message.trim()}
            className="flex-1 bg-primary text-primary-foreground"
          >
            <Megaphone className="w-3.5 h-3.5 mr-1" /> Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SettingEditModal({
  setting, onClose, onConfirm,
}: {
  setting: any | null;
  onClose: () => void;
  onConfirm: (key: string, value: any, description?: string) => void;
}) {
  const [key, setKey] = useState("");
  const [valueText, setValueText] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (setting) {
      setKey(setting.key || "");
      setValueText(JSON.stringify(setting.value ?? {}, null, 2));
      setDescription(setting.description || "");
      setError("");
    }
  }, [setting]);
  if (!setting) return null;
  const isNew = !setting.key;

  const handleSave = () => {
    let parsed: any;
    try {
      parsed = JSON.parse(valueText);
    } catch {
      setError("Value is not valid JSON");
      return;
    }
    if (!key.trim()) { setError("Key required"); return; }
    onConfirm(key.trim(), parsed, description.trim() || undefined);
  };

  return (
    <Dialog open={!!setting} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary" /> {isNew ? "New Setting" : "Edit Setting"}
          </DialogTitle>
          <DialogDescription>
            {isNew ? "Create a new feature flag or config value." : "Edit this setting. Saves immediately to live app."}
          </DialogDescription>
        </DialogHeader>

        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Key</p>
          <Input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            disabled={!isNew}
            placeholder="e.g. feature_X_enabled"
            className="h-10 rounded-lg font-mono"
          />
        </div>

        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Value (JSON)</p>
          <Textarea
            value={valueText}
            onChange={(e) => { setValueText(e.target.value); setError(""); }}
            placeholder='e.g. {"enabled": true}'
            className="rounded-lg text-xs min-h-[120px] font-mono"
          />
        </div>

        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Description (optional)</p>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-10 rounded-lg" />
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleSave} disabled={!key.trim() || !valueText.trim()} className="flex-1 bg-primary text-primary-foreground">
            <Save className="w-3.5 h-3.5 mr-1" /> Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

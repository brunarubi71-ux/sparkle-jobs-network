import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sendNotification } from "@/lib/notifications";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Shield, Users, Briefcase, DollarSign, BarChart3, ShieldCheck,
  Check, X, Crown, AlertTriangle, Ban, RotateCcw, Search, Eye, TrendingUp,
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

type Tab = "metrics" | "revenue" | "users" | "identity" | "jobs" | "disputes";
type RoleFilter = "all" | "owner" | "cleaner" | "helper";
type StatusFilter = "all" | "verified" | "pending" | "unverified" | "suspended";
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
    const [profilesRes, jobsRes, disputesRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("jobs").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("disputes").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    const p = profilesRes.data || [];
    const j = jobsRes.data || [];
    const d = disputesRes.data || [];
    setUsers(p);
    setJobs(j);
    setDisputes(d);
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
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-foreground">User Management</h2>
              <span className="text-xs text-muted-foreground">{filteredUsers.length} of {users.filter((u: any) => u.role !== "admin").length}</span>
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
                      <Button size="sm" variant="outline" onClick={() => setChangePlanUser(u)} className="h-8 text-[11px]">
                        Change Plan
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleSuspend(u)}
                        className={`h-8 text-[11px] ${isSuspended ? "text-emerald-600 border-emerald-300 hover:bg-emerald-50" : "text-destructive border-destructive/30 hover:bg-destructive/5"}`}
                      >
                        {isSuspended ? (<><RotateCcw className="w-3 h-3 mr-1" /> Activate</>) : (<><Ban className="w-3 h-3 mr-1" /> Suspend</>)}
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
                  </div>
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
  const [notes, setNotes] = useState(dispute.admin_notes || "");
  const [saving, setSaving] = useState(false);
  const reporter = users.find((u: any) => u.id === dispute.reporter_id);
  const reported = users.find((u: any) => u.id === dispute.reported_id);
  const job = jobs.find((j: any) => j.id === dispute.job_id);
  const isOpen = dispute.status === "open";

  const resolve = async (decision: "refund_owner" | "pay_cleaner" | "dismiss") => {
    setSaving(true);
    const { error } = await supabase
      .from("disputes")
      .update({
        status: "resolved",
        admin_decision: decision,
        admin_notes: notes || null,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", dispute.id);
    setSaving(false);
    if (error) { toast.error("Failed to resolve dispute"); return; }
    toast.success("Dispute resolved");
    onResolved();
  };

  const statusBadge = isOpen
    ? <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px]">Open</Badge>
    : <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px]">Resolved</Badge>;

  return (
    <div className="bg-card rounded-xl shadow-card p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">
            {job?.title || "Job"} · ${Number(job?.price || 0).toFixed(2)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {new Date(dispute.created_at).toLocaleString()}
          </p>
        </div>
        {statusBadge}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-muted/40 rounded-lg p-2">
          <p className="text-[10px] text-muted-foreground">Reporter ({dispute.reporter_type})</p>
          <p className="text-foreground truncate">{reporter?.full_name || reporter?.email || "—"}</p>
        </div>
        <div className="bg-muted/40 rounded-lg p-2">
          <p className="text-[10px] text-muted-foreground">Reported</p>
          <p className="text-foreground truncate">{reported?.full_name || reported?.email || "—"}</p>
        </div>
      </div>

      <div>
        <p className="text-[10px] text-muted-foreground mb-1">Reason</p>
        <p className="text-xs text-foreground bg-muted/40 rounded-lg p-2">{dispute.reason}</p>
      </div>

      {dispute.response && (
        <div>
          <p className="text-[10px] text-muted-foreground mb-1">Reported's response</p>
          <p className="text-xs text-foreground bg-muted/40 rounded-lg p-2">{dispute.response}</p>
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
              disabled={saving}
              onClick={() => resolve("pay_cleaner")}
              className="h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px]"
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
          <p><span className="font-medium text-foreground">Decision:</span> {dispute.admin_decision || "—"}</p>
          {dispute.admin_notes && <p className="mt-1">{dispute.admin_notes}</p>}
        </div>
      )}
    </div>
  );
}

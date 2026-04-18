import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, Users, Briefcase, DollarSign, Star, Crown, LogOut, BarChart3, ShieldCheck, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Tab = "overview" | "users" | "jobs" | "payments" | "reviews" | "premium" | "identity";

export default function AdminDashboard() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState({ users: 0, cleaners: 0, owners: 0, jobs: 0, openJobs: 0, completedJobs: 0, totalRevenue: 0, premiumUsers: 0, reviews: 0 });
  const [users, setUsers] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile && (profile.role as string) !== "admin") {
      navigate("/");
      return;
    }
    fetchAll();
  }, [profile]);

  const fetchAll = async () => {
    setLoading(true);
    const [profilesRes, jobsRes, reviewsRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("jobs").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("reviews").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    const p = profilesRes.data || [];
    const j = jobsRes.data || [];
    const r = reviewsRes.data || [];
    setUsers(p);
    setJobs(j);
    setReviews(r);
    setStats({
      users: p.length,
      cleaners: p.filter(u => u.role === "cleaner").length,
      owners: p.filter(u => u.role === "owner").length,
      jobs: j.length,
      openJobs: j.filter(x => x.status === "open").length,
      completedJobs: j.filter(x => x.status === "completed").length,
      totalRevenue: j.filter(x => x.status === "completed").reduce((s: number, x: any) => s + (x.platform_fee || 0), 0),
      premiumUsers: p.filter(u => u.is_premium).length,
      reviews: r.length,
    });
    setLoading(false);
  };

  const handleLogout = async () => { await signOut(); navigate("/admin-login"); };

  const pendingIdentity = users.filter((u: any) => u.identity_status === "pending");

  const reviewIdentity = async (userId: string, decision: "approved" | "rejected") => {
    const { error } = await supabase
      .from("profiles")
      .update({ identity_status: decision, identity_reviewed_at: new Date().toISOString() } as any)
      .eq("id", userId);
    if (error) { toast.error("Failed to update status"); return; }
    toast.success(`Identity ${decision}`);
    fetchAll();
  };

  const getSignedDocUrl = async (path: string | null): Promise<string | null> => {
    if (!path) return null;
    const { data } = await supabase.storage.from("identity-docs").createSignedUrl(path, 60 * 10);
    return data?.signedUrl || null;
  };

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "overview", label: "Overview", icon: BarChart3 },
    { key: "users", label: "Users", icon: Users },
    { key: "jobs", label: "Jobs", icon: Briefcase },
    { key: "payments", label: "Payments", icon: DollarSign },
    { key: "reviews", label: "Reviews", icon: Star },
    { key: "premium", label: "Premium", icon: Crown },
    { key: "identity", label: "Identity", icon: ShieldCheck },
  ];

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar-style top nav for mobile/desktop */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h1 className="font-bold text-foreground">Shinely Admin</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout}><LogOut className="w-4 h-4" /></Button>
      </div>

      {/* Tab bar */}
      <div className="bg-card border-b border-border px-2 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 max-w-5xl mx-auto">
        {tab === "overview" && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total Users", value: stats.users, icon: Users, color: "text-primary" },
              { label: "Cleaners", value: stats.cleaners, icon: Users, color: "text-purple-500" },
              { label: "Owners", value: stats.owners, icon: Users, color: "text-blue-500" },
              { label: "Total Jobs", value: stats.jobs, icon: Briefcase, color: "text-emerald-500" },
              { label: "Open Jobs", value: stats.openJobs, icon: Briefcase, color: "text-amber-500" },
              { label: "Completed", value: stats.completedJobs, icon: Briefcase, color: "text-green-500" },
              { label: "Revenue", value: `$${stats.totalRevenue.toFixed(2)}`, icon: DollarSign, color: "text-emerald-600" },
              { label: "Premium", value: stats.premiumUsers, icon: Crown, color: "text-amber-500" },
            ].map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-card rounded-xl shadow-card p-4">
                <s.icon className={`w-5 h-5 ${s.color} mb-2`} />
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </motion.div>
            ))}
          </div>
        )}

        {tab === "users" && (
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-foreground mb-3">User Management</h2>
            {users.map(u => (
              <div key={u.id} className="bg-card rounded-xl shadow-card p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{u.full_name || "Unnamed"}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] capitalize">{u.role}</Badge>
                  {u.is_premium && <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px]">Premium</Badge>}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "jobs" && (
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-foreground mb-3">Jobs Management</h2>
            {jobs.map(j => (
              <div key={j.id} className="bg-card rounded-xl shadow-card p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-foreground">{j.title}</p>
                  <Badge variant="outline" className="text-[10px] capitalize">{j.status}</Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>${j.price}</span>
                  <span>{j.city || "N/A"}</span>
                  <span>Fee: ${j.platform_fee || 0}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "payments" && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-foreground mb-3">Payments & Commissions</h2>
            <div className="bg-card rounded-xl shadow-card p-4 mb-4">
              <p className="text-2xl font-bold text-primary">${stats.totalRevenue.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Total platform revenue (10% commission)</p>
            </div>
            {jobs.filter(j => j.status === "completed").map(j => (
              <div key={j.id} className="bg-card rounded-xl shadow-card p-3">
                <p className="text-sm font-medium text-foreground">{j.title}</p>
                <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                  <span>Total: ${j.total_amount || j.price}</span>
                  <span className="text-primary">Fee: ${j.platform_fee || (j.price * 0.1).toFixed(2)}</span>
                  <span>Cleaner: ${j.cleaner_earnings || (j.price * 0.9).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "reviews" && (
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-foreground mb-3">Reviews & Reports</h2>
            {reviews.map(r => (
              <div key={r.id} className="bg-card rounded-xl shadow-card p-3">
                <div className="flex items-center gap-1 mb-1">
                  {Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />)}
                </div>
                {r.review_text && <p className="text-xs text-muted-foreground">{r.review_text}</p>}
              </div>
            ))}
          </div>
        )}

        {tab === "premium" && (
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-foreground mb-3">Premium Users</h2>
            {users.filter(u => u.is_premium).map(u => (
              <div key={u.id} className="bg-card rounded-xl shadow-card p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{u.full_name || "Unnamed"}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px]">Premium</Badge>
              </div>
            ))}
            {users.filter(u => u.is_premium).length === 0 && (
              <p className="text-muted-foreground text-sm">No premium users yet.</p>
            )}
          </div>
        )}

        {tab === "identity" && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" /> Identity Verification ({pendingIdentity.length} pending)
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
      </div>
    </div>
  );
}

function IdentityReviewCard({ user, getSignedUrl, onDecide }: { user: any; getSignedUrl: (p: string | null) => Promise<string | null>; onDecide: (id: string, d: "approved" | "rejected") => void }) {
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setDocUrl(await getSignedUrl(user.identity_document_url));
      setSelfieUrl(await getSignedUrl(user.identity_selfie_url));
    })();
  }, [user.id]);

  return (
    <div className="bg-card rounded-xl shadow-card p-3 space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">{user.full_name || "Unnamed"}</p>
        <p className="text-xs text-muted-foreground">{user.email}</p>
        {user.identity_submitted_at && (
          <p className="text-[10px] text-muted-foreground mt-0.5">Submitted: {new Date(user.identity_submitted_at).toLocaleString()}</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] text-muted-foreground mb-1">Document</p>
          {docUrl ? (
            <a href={docUrl} target="_blank" rel="noreferrer">
              <img src={docUrl} alt="Document" className="w-full aspect-square object-cover rounded-lg border border-border" />
            </a>
          ) : <div className="aspect-square bg-muted rounded-lg" />}
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground mb-1">Selfie</p>
          {selfieUrl ? (
            <a href={selfieUrl} target="_blank" rel="noreferrer">
              <img src={selfieUrl} alt="Selfie" className="w-full aspect-square object-cover rounded-lg border border-border" />
            </a>
          ) : <div className="aspect-square bg-muted rounded-lg" />}
        </div>
      </div>
      <div className="flex gap-2">
        <Button onClick={() => onDecide(user.id, "approved")} className="flex-1 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
          <Check className="w-3.5 h-3.5 mr-1" /> Approve
        </Button>
        <Button onClick={() => onDecide(user.id, "rejected")} variant="outline" className="flex-1 h-9 rounded-lg text-destructive border-destructive/30 text-xs">
          <X className="w-3.5 h-3.5 mr-1" /> Reject
        </Button>
      </div>
    </div>
  );
}

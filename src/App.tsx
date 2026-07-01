import { lazy, Suspense, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { NotificationsProvider } from "@/hooks/useNotifications";
import { LanguageProvider } from "@/i18n/LanguageContext";
import SplashScreen from "@/components/SplashScreen";
import PointsToast from "@/components/PointsToast";
import SupportAlertBanner from "@/components/SupportAlertBanner";
import AIChatWidget from "@/components/AIChatWidget";
import { AnimatePresence } from "framer-motion";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const Jobs            = lazy(() => import("./pages/Jobs"));
const Schedules       = lazy(() => import("./pages/Schedules"));
const Chat            = lazy(() => import("./pages/Chat"));
const ChatConversation= lazy(() => import("./pages/ChatConversation"));

const Profile         = lazy(() => import("./pages/Profile"));
const PostJob         = lazy(() => import("./pages/PostJob"));
const MyJobs          = lazy(() => import("./pages/MyJobs"));
const CleanerMyJobs   = lazy(() => import("./pages/CleanerMyJobs"));
const SellSchedule    = lazy(() => import("./pages/SellSchedule"));
const JobDetails      = lazy(() => import("./pages/JobDetails"));
const PublicProfile   = lazy(() => import("./pages/PublicProfile"));
const Auth            = lazy(() => import("./pages/Auth"));
const AdminLogin      = lazy(() => import("./pages/AdminLogin"));
const AdminDashboard  = lazy(() => import("./pages/AdminDashboard"));
const NotFound        = lazy(() => import("./pages/NotFound"));
const Earnings        = lazy(() => import("./pages/Earnings"));
const CheckoutReturn  = lazy(() => import("./pages/CheckoutReturn"));
const Wallet          = lazy(() => import("./pages/Wallet"));
const Terms           = lazy(() => import("./pages/Terms"));
const Privacy         = lazy(() => import("./pages/Privacy"));
const Cancellation    = lazy(() => import("./pages/Cancellation"));
const InvitePage           = lazy(() => import("./pages/InvitePage"));
const HelperJobInvitePage  = lazy(() => import("./pages/HelperJobInvitePage"));
const AuthCallback         = lazy(() => import("./pages/AuthCallback"));

const queryClient = new QueryClient();

function PageLoader() {
  const [showRetry, setShowRetry] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShowRetry(true), 10000);
    return () => clearTimeout(t);
  }, []);

  const handleRetry = () => {
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith("sb-") || k.startsWith("supabase")) localStorage.removeItem(k);
    });
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) =>
        Promise.all(regs.map((r) => r.unregister()))
      );
    }
    window.location.href = "/auth";
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6">
      <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      {showRetry && (
        <>
          <p className="text-sm text-muted-foreground text-center">
            Levando mais tempo que o esperado...
          </p>
          <button
            onClick={handleRetry}
            className="px-6 py-2.5 bg-primary text-white rounded-full text-sm font-semibold shadow"
          >
            Tentar novamente
          </button>
        </>
      )}
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/admin-login" replace />;
  if (profile && (profile.role as string) !== "admin") return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isPasswordRecovery } = useAuth();
  if (loading) return <PageLoader />;
  if (user && !isPasswordRecovery) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RoleHome() {
  const { profile, loading, profileLoading, signOut } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    // Only start the bail-out timer after auth + profile loading both finish
    // and profile is still null — avoids kicking logged-in users during fetch
    if (loading || profileLoading || profile) return;
    const t = setTimeout(async () => {
      // Sign out before navigating so AuthRoute doesn't loop back to "/"
      await signOut();
      setTimedOut(true);
    }, 10000);
    return () => clearTimeout(t);
  }, [loading, profileLoading, profile, signOut]);

  if (loading || profileLoading || !profile) {
    if (timedOut) return <Navigate to="/auth" replace />;
    return <PageLoader />;
  }

  if (profile.role === 'admin') return <Navigate to='/admin' replace />;
  if ((profile.role as string) === 'owner') return <Navigate to='/post-job' replace />;
  return <Jobs />;
}

function HomeRoute() {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  return <RoleHome />;
}

const SPLASH_KEY = "shinely_splash_shown";

function PushInit() {
  usePushNotifications();
  return null;
}

const App = () => {
  const [showSplash, setShowSplash] = useState(() => {
    if (typeof window === "undefined") return false;
    // Only show splash when landing on root path, never on direct deep-link navigation
    if (window.location.pathname !== "/") return false;
    return sessionStorage.getItem(SPLASH_KEY) !== "1";
  });

  useEffect(() => {
    if (!showSplash) return;
    try { sessionStorage.setItem(SPLASH_KEY, "1"); } catch {}
    const t = setTimeout(() => setShowSplash(false), 2000);
    return () => clearTimeout(t);
  }, [showSplash]);

  return (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <BrowserRouter>
        <AuthProvider>
          <NotificationsProvider>
          <PushInit />
          <TooltipProvider>
            <Sonner />
            <PointsToast />
            <SupportAlertBanner />
            <AIChatWidget />
            <AnimatePresence>{showSplash && <SplashScreen key="splash" />}</AnimatePresence>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/invite/:referrerId" element={<InvitePage />} />
                <Route path="/helper-invite/:jobId" element={<HelperJobInvitePage />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/cancellation" element={<Cancellation />} />
                <Route path="/admin-login" element={<AdminLogin />} />
                <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                <Route path="/" element={<HomeRoute />} />
                <Route path="/jobs" element={<ProtectedRoute><Jobs /></ProtectedRoute>} />
                <Route path="/schedules" element={<ProtectedRoute><Schedules /></ProtectedRoute>} />
                <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
                <Route path="/chat/:id" element={<ProtectedRoute><ChatConversation /></ProtectedRoute>} />
                <Route path="/premium" element={<Navigate to="/profile" replace />} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/profile/:id" element={<ProtectedRoute><PublicProfile /></ProtectedRoute>} />
                <Route path="/post-job" element={<ProtectedRoute><PostJob /></ProtectedRoute>} />
                <Route path="/my-jobs" element={<ProtectedRoute><MyJobs /></ProtectedRoute>} />
                <Route path="/cleaner-my-jobs" element={<ProtectedRoute><CleanerMyJobs /></ProtectedRoute>} />
                <Route path="/sell-schedule" element={<ProtectedRoute><SellSchedule /></ProtectedRoute>} />
                <Route path="/job/:id" element={<ProtectedRoute><JobDetails /></ProtectedRoute>} />
                <Route path="/earnings" element={<ProtectedRoute><Earnings /></ProtectedRoute>} />
                <Route path="/checkout/return" element={<ProtectedRoute><CheckoutReturn /></ProtectedRoute>} />
                <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </TooltipProvider>
          </NotificationsProvider>
        </AuthProvider>
      </BrowserRouter>
    </LanguageProvider>
  </QueryClientProvider>
  );
};

export default App;

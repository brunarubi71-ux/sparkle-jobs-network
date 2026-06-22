import { lazy, Suspense, useEffect, useRef, useState } from "react";
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

const queryClient = new QueryClient();

function PageLoader({ hint }: { hint?: string } = {}) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      {hint && <p className="text-sm text-muted-foreground text-center px-8">{hint}</p>}
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
  const { profile, loading } = useAuth();
  const [timedOut, setTimedOut] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!loading && !profile) {
      timerRef.current = setTimeout(() => setTimedOut(true), 12000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [loading, profile]);

  if (timedOut) return <Navigate to="/auth" replace />;
  if (loading || !profile) return <PageLoader />;

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

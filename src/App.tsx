import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { LanguageProvider } from "@/i18n/LanguageContext";
import Jobs from "./pages/Jobs";
import Schedules from "./pages/Schedules";
import Chat from "./pages/Chat";
import ChatConversation from "./pages/ChatConversation";
import Premium from "./pages/Premium";
import Profile from "./pages/Profile";
import PostJob from "./pages/PostJob";
import MyJobs from "./pages/MyJobs";
import CleanerMyJobs from "./pages/CleanerMyJobs";
import SellSchedule from "./pages/SellSchedule";
import JobDetails from "./pages/JobDetails";
import PublicProfile from "./pages/PublicProfile";
import Auth from "./pages/Auth";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";
import Earnings from "./pages/Earnings";
import CheckoutReturn from "./pages/CheckoutReturn";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background" />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background" />;
  if (!user) return <Navigate to="/admin-login" replace />;
  if (profile && (profile.role as string) !== "admin") return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background" />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RoleHome() {
  const { profile } = useAuth();
  if (profile?.role === "owner") return <PostJob />;
  // Helpers see the same Jobs feed as cleaners
  return <Jobs />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <BrowserRouter>
        <AuthProvider>
          <TooltipProvider>
            <Sonner />
            <Routes>
              <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
              <Route path="/admin-login" element={<AdminLogin />} />
              <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
              <Route path="/" element={<ProtectedRoute><RoleHome /></ProtectedRoute>} />
              <Route path="/jobs" element={<ProtectedRoute><Jobs /></ProtectedRoute>} />
              <Route path="/schedules" element={<ProtectedRoute><Schedules /></ProtectedRoute>} />
              <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
              <Route path="/chat/:id" element={<ProtectedRoute><ChatConversation /></ProtectedRoute>} />
              <Route path="/premium" element={<ProtectedRoute><Premium /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/profile/:id" element={<ProtectedRoute><PublicProfile /></ProtectedRoute>} />
              <Route path="/post-job" element={<ProtectedRoute><PostJob /></ProtectedRoute>} />
              <Route path="/my-jobs" element={<ProtectedRoute><MyJobs /></ProtectedRoute>} />
              <Route path="/cleaner-my-jobs" element={<ProtectedRoute><CleanerMyJobs /></ProtectedRoute>} />
              <Route path="/sell-schedule" element={<ProtectedRoute><SellSchedule /></ProtectedRoute>} />
              <Route path="/job/:id" element={<ProtectedRoute><JobDetails /></ProtectedRoute>} />
              <Route path="/earnings" element={<ProtectedRoute><Earnings /></ProtectedRoute>} />
              <Route path="/checkout/return" element={<ProtectedRoute><CheckoutReturn /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </TooltipProvider>
        </AuthProvider>
      </BrowserRouter>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;

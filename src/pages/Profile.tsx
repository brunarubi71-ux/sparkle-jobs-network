import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { Crown, MapPin, Briefcase, Star, LogOut, Settings, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import BottomNav from "@/components/BottomNav";
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="gradient-primary px-4 pt-8 pb-16 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-20 h-20 rounded-full bg-primary-foreground/20 mx-auto flex items-center justify-center mb-3"
        >
          <span className="text-2xl font-bold text-primary-foreground">
            {profile?.full_name?.charAt(0)?.toUpperCase() || "?"}
          </span>
        </motion.div>
        <h1 className="text-xl font-bold text-primary-foreground">{profile?.full_name || "User"}</h1>
        <div className="flex items-center justify-center gap-2 mt-1">
          {profile?.is_premium && (
            <span className="inline-flex items-center gap-1 bg-primary-foreground/20 text-primary-foreground text-xs px-2 py-0.5 rounded-full">
              <Crown className="w-3 h-3" /> Premium
            </span>
          )}
          <span className="text-primary-foreground/70 text-sm capitalize">{profile?.role}</span>
        </div>
      </div>

      <div className="px-4 -mt-8 relative z-10 space-y-3">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-card rounded-2xl shadow-card p-4"
        >
          <h3 className="text-sm font-semibold text-foreground mb-3">Details</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4 text-primary" /> {profile?.city || "Not set"}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Briefcase className="w-4 h-4 text-primary" /> {profile?.role === "cleaner" ? "Cleaner" : "Job Owner"}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Star className="w-4 h-4 text-primary" /> Rating: 5.0 ⭐
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Award className="w-4 h-4 text-primary" /> Jobs completed: 0
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-2xl shadow-card p-4"
        >
          <h3 className="text-sm font-semibold text-foreground mb-3">Earnings</h3>
          <p className="text-2xl font-bold text-foreground">$0.00</p>
          <p className="text-xs text-muted-foreground">Total earnings</p>
        </motion.div>

        <Button
          variant="outline"
          className="w-full h-12 rounded-xl border-border text-muted-foreground"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 mr-2" /> Log Out
        </Button>
      </div>

      <BottomNav />
    </div>
  );
}

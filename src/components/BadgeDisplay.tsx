import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Award, Star, Sparkles, Trophy, Crown, Gem, Heart, HandHelping } from "lucide-react";
import { motion } from "framer-motion";

interface BadgeStyle {
  icon: typeof Award;
  className: string;
  emoji: string;
}

const BADGE_STYLES: Record<string, BadgeStyle> = {
  "First Job":       { icon: Star,       emoji: "🎯", className: "bg-blue-100 text-blue-700 border-blue-200" },
  "Rising Cleaner":  { icon: Sparkles,   emoji: "⭐", className: "bg-amber-100 text-amber-700 border-amber-200" },
  "Top Cleaner":     { icon: Trophy,     emoji: "🌟", className: "bg-orange-100 text-orange-700 border-orange-200" },
  "Elite Cleaner":   { icon: Crown,      emoji: "💎", className: "bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0" },
  "Rising Helper":   { icon: HandHelping,emoji: "🤝", className: "bg-violet-100 text-violet-700 border-violet-200" },
  "Top Helper":      { icon: Heart,      emoji: "💜", className: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200" },
  "Elite Helper":    { icon: Gem,        emoji: "💠", className: "bg-gradient-to-r from-violet-500 to-purple-600 text-white border-0" },
  "5-Star Pro":      { icon: Star,       emoji: "🏆", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  "High Earner":     { icon: Trophy,     emoji: "💰", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  "Top Earner":      { icon: Crown,      emoji: "🤑", className: "bg-emerald-200 text-emerald-800 border-emerald-300" },
};

const DEFAULT_STYLE: BadgeStyle = { icon: Award, emoji: "🏅", className: "bg-muted text-muted-foreground border-border" };

interface Reward { id: string; badge_name: string; earned_at: string; }

interface Props {
  userId: string;
  compact?: boolean;
}

export default function BadgeDisplay({ userId, compact = false }: Props) {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("rewards")
        .select("*")
        .eq("user_id", userId)
        .order("earned_at", { ascending: false });
      setRewards((data as Reward[]) || []);
      setLoading(false);
    })();
  }, [userId]);

  if (loading || rewards.length === 0) return null;

  return (
    <div className="bg-card rounded-2xl shadow-card p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <Award className="w-4 h-4 text-primary" /> Badges ({rewards.length})
      </h3>
      <div className="flex flex-wrap gap-2">
        {rewards.map((r, idx) => {
          const style = BADGE_STYLES[r.badge_name] || DEFAULT_STYLE;
          const Icon = style.icon;
          return (
            <motion.div
              key={r.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: idx * 0.04, type: "spring", stiffness: 200 }}
            >
              <Badge className={`${style.className} text-xs font-semibold px-3 py-1.5 gap-1.5`}>
                <Icon className="w-3.5 h-3.5" />
                {compact ? style.emoji : r.badge_name}
              </Badge>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

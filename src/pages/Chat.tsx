import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { useLanguage } from "@/i18n/LanguageContext";

interface Conversation {
  id: string;
  job_id: string | null;
  cleaner_id: string;
  owner_id: string;
  created_at: string;
}

export default function Chat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchConversations();
  }, [user]);

  const fetchConversations = async () => {
    const { data } = await supabase.from("conversations").select("*").order("created_at", { ascending: false });
    setConversations((data as Conversation[]) || []);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-foreground">{t("chat.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("chat.subtitle")}</p>
      </div>

      <div className="px-4 space-y-2">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-card rounded-2xl p-4 shimmer h-16" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">{t("chat.no_conversations")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("chat.no_conversations_hint")}</p>
          </div>
        ) : (
          conversations.map((conv, i) => (
            <motion.button
              key={conv.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => navigate(`/chat/${conv.id}`)}
              className="w-full bg-card rounded-2xl p-4 shadow-card flex items-center gap-3 active:scale-[0.98] transition-transform text-left"
            >
              <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{t("chat.conversation")}</p>
                <p className="text-xs text-muted-foreground">{new Date(conv.created_at).toLocaleDateString()}</p>
              </div>
            </motion.button>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
}

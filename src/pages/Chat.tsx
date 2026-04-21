import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import BottomNav from "@/components/BottomNav";
import EmptyState from "@/components/EmptyState";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

interface Conversation {
  id: string;
  job_id: string | null;
  cleaner_id: string;
  owner_id: string;
  created_at: string;
}

interface ProfileLite {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface ConversationView extends Conversation {
  otherUser: ProfileLite | null;
  jobTitle: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  lastMessageSenderId: string | null;
}

const readKey = (convId: string) => `last_read_${convId}`;

export default function Chat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [conversations, setConversations] = useState<ConversationView[]>([]);
  const [loading, setLoading] = useState(true);
  const [readTick, setReadTick] = useState(0);

  useEffect(() => {
    if (!user) return;
    fetchConversations();
    // Mark chat as visited so unread badge clears
    localStorage.setItem(`chat_last_visited_${user.id}`, new Date().toISOString());

    // Realtime: refresh on any new message in conversations the user participates in
    const channel = supabase
      .channel(`chat-list-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => fetchConversations()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchConversations = async () => {
    if (!user) return;
    try {
      const { data: convs, error } = await supabase
        .from("conversations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const conversationsRaw = (convs as Conversation[]) || [];
      if (conversationsRaw.length === 0) {
        setConversations([]);
        return;
      }

      const otherUserIds = Array.from(
        new Set(
          conversationsRaw.map((c) => (c.cleaner_id === user.id ? c.owner_id : c.cleaner_id))
        )
      );
      const jobIds = Array.from(
        new Set(conversationsRaw.map((c) => c.job_id).filter((j): j is string => !!j))
      );
      const conversationIds = conversationsRaw.map((c) => c.id);

      const [{ data: profiles }, { data: jobs }, { data: messages }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, avatar_url").in("id", otherUserIds),
        jobIds.length
          ? supabase.from("jobs").select("id, title").in("id", jobIds)
          : Promise.resolve({ data: [] as { id: string; title: string }[] }),
        supabase
          .from("messages")
          .select("conversation_id, message_text, created_at")
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: false }),
      ]);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p as ProfileLite]));
      const jobMap = new Map((jobs || []).map((j: any) => [j.id, j.title as string]));
      const lastMsgMap = new Map<string, { text: string; at: string; sender: string }>();
      (messages || []).forEach((m: any) => {
        if (!lastMsgMap.has(m.conversation_id)) {
          lastMsgMap.set(m.conversation_id, { text: m.message_text, at: m.created_at, sender: m.sender_id });
        }
      });

      const enriched: ConversationView[] = conversationsRaw.map((c) => {
        const otherId = c.cleaner_id === user.id ? c.owner_id : c.cleaner_id;
        const last = lastMsgMap.get(c.id);
        return {
          ...c,
          otherUser: profileMap.get(otherId) || null,
          jobTitle: c.job_id ? jobMap.get(c.job_id) || null : null,
          lastMessage: last?.text || null,
          lastMessageAt: last?.at || null,
          lastMessageSenderId: last?.sender || null,
        };
      });

      // Sort by latest activity (last message or conversation creation)
      enriched.sort((a, b) => {
        const aT = new Date(a.lastMessageAt || a.created_at).getTime();
        const bT = new Date(b.lastMessageAt || b.created_at).getTime();
        return bT - aT;
      });

      setConversations(enriched);
    } catch (err) {
      console.error("[Chat] fetch error:", err);
      toast.error("Couldn't load conversations. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
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
          <EmptyState
            icon={MessageCircle}
            title="No conversations yet 💬"
            description="Accept a job to start chatting with cleaners and owners!"
          />
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
              {conv.otherUser?.avatar_url ? (
                <img
                  src={conv.otherUser.avatar_url}
                  alt={conv.otherUser.full_name || "User"}
                  className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-semibold text-primary-foreground">
                    {getInitials(conv.otherUser?.full_name || null)}
                  </span>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {conv.otherUser?.full_name || t("chat.conversation")}
                  </p>
                  {conv.lastMessageAt && (
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true })}
                    </span>
                  )}
                </div>
                {conv.jobTitle && (
                  <p className="text-xs text-primary truncate">{conv.jobTitle}</p>
                )}
                <p className="text-xs text-muted-foreground truncate">
                  {conv.lastMessage || t("chat.no_messages_yet") || "No messages yet"}
                </p>
              </div>
            </motion.button>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
}

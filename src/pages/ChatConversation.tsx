import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Send, AlertTriangle, Shield, Lock, Languages, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { detectContactInfo, maskContactInfo } from "@/lib/contactFilter";
import { logViolation, getPenaltyMessage } from "@/lib/platformProtection";
import PlatformWarningBanner from "@/components/PlatformWarningBanner";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  translateText,
  LANGUAGE_FLAGS,
  LANGUAGE_LABELS,
  normalizeLanguage,
} from "@/lib/translate";
import type { Language } from "@/i18n/translations";

interface Message {
  id: string;
  sender_id: string;
  message_text: string;
  created_at: string;
}

type JobStatus = "open" | "applied" | "hired" | "accepted" | "in_progress" | "pending_review" | "completed" | "cancelled";

const PRE_ACCEPTANCE_STATUSES: JobStatus[] = ["open", "applied", "hired"];
const POST_ACCEPTANCE_STATUSES: JobStatus[] = ["accepted", "in_progress", "pending_review", "completed"];

export default function ChatConversation() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [contactWarning, setContactWarning] = useState(false);
  const [jobStatus, setJobStatus] = useState<JobStatus>("open");
  const [userRole, setUserRole] = useState<"cleaner" | "owner">("cleaner");
  const [violationScore, setViolationScore] = useState(0);
  const [warningCount, setWarningCount] = useState(0);
  const [otherTyping, setOtherTyping] = useState(false);
  const [otherUserName, setOtherUserName] = useState<string | null>(null);
  const [otherUserAvatar, setOtherUserAvatar] = useState<string | null>(null);
  const [otherUserId, setOtherUserId] = useState<string | null>(null);
  const [otherUserLanguage, setOtherUserLanguage] = useState<Language | null>(null);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translatingIds, setTranslatingIds] = useState<Set<string>>(new Set());
  const { language: myLanguage } = useLanguage();
  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isPreAcceptance = PRE_ACCEPTANCE_STATUSES.includes(jobStatus);
  const isPostAcceptance = POST_ACCEPTANCE_STATUSES.includes(jobStatus);

  useEffect(() => {
    if (!id || !user) return;
    fetchMessages();
    checkJobStatus();
    fetchUserProfile();

    const channel = supabase
      .channel(`messages-${id}`, { config: { presence: { key: user.id } } })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        (payload) => {
          setMessages((prev) => {
            const next = payload.new as Message;
            if (prev.some((m) => m.id === next.id)) return prev;
            return [...prev, next];
          });
        }
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, Array<{ typing?: boolean; user_id?: string }>>;
        const someoneElseTyping = Object.entries(state).some(([key, metas]) =>
          key !== user.id && metas.some((m) => m.typing === true)
        );
        setOtherTyping(someoneElseTyping);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: user.id, typing: false });
        }
      });

    channelRef.current = channel;
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      channel.unsubscribe();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [id, user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, otherTyping]);

  const broadcastTyping = (typing: boolean) => {
    const channel = channelRef.current;
    if (!channel || !user) return;
    channel.track({ user_id: user.id, typing });
  };

  const handleInputChange = (value: string) => {
    setNewMsg(value);
    broadcastTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => broadcastTyping(false), 1500);
  };

  const fetchUserProfile = async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("role, violation_score").eq("id", user.id).single();
    if (data) {
      setUserRole((data as any).role === "owner" ? "owner" : "cleaner");
      setViolationScore((data as any).violation_score || 0);
    }
  };

  const checkJobStatus = async () => {
    const { data: conv } = await supabase.from("conversations").select("job_id, cleaner_id, owner_id").eq("id", id!).single();
    if (conv) {
      const otherId = conv.cleaner_id === user!.id ? conv.owner_id : conv.cleaner_id;
      setOtherUserId(otherId);
      const { data: otherProfile } = await supabase
        .from("public_profiles" as any)
        .select("full_name, avatar_url, language")
        .eq("id", otherId)
        .single();
      if (otherProfile) {
        setOtherUserName((otherProfile as any).full_name || null);
        setOtherUserAvatar((otherProfile as any).avatar_url || null);
        setOtherUserLanguage(normalizeLanguage((otherProfile as any).language));
      }
    }
    if (conv?.job_id) {
      const { data: job } = await supabase.from("public_jobs" as any).select("status").eq("id", conv.job_id).single();
      if (job) setJobStatus(job.status as JobStatus);
    }
  };

  const fetchMessages = async () => {
    const { data } = await supabase.from("messages").select("*").eq("conversation_id", id!).order("created_at", { ascending: true });
    setMessages((data as Message[]) || []);
  };

  const sendMessage = async () => {
    if (!newMsg.trim() || !user || !id) return;

    const detection = detectContactInfo(newMsg);
    if (detection.detected) {
      setContactWarning(true);
      setWarningCount((prev) => prev + 1);
      await logViolation(user.id, detection.types[0], "chat", maskContactInfo(newMsg));
      setViolationScore((prev) => prev + 1);
      toast.warning("⚠️ Sharing contact information is not allowed. Please complete the booking through Shinely.");
      return;
    }

    const text = newMsg.trim();
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic: Message = {
      id: tempId,
      sender_id: user.id,
      message_text: text,
      created_at: new Date().toISOString(),
    };
    // Optimistic UI
    setMessages((prev) => [...prev, optimistic]);
    setNewMsg("");
    setContactWarning(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    broadcastTyping(false);
    setSending(true);

    const { data: inserted, error } = await supabase
      .from("messages")
      .insert({ conversation_id: id, sender_id: user.id, message_text: text })
      .select("id, sender_id, message_text, created_at")
      .single();

    if (error) {
      console.error("[Chat] Failed to send message:", error);
      toast.error(error.message || "Failed to send message");
      // Roll back optimistic message
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setNewMsg(text);
      setSending(false);
      return;
    }

    // Reconcile temp → real (also covers case where realtime arrived first)
    setMessages((prev) => {
      const withoutTemp = prev.filter((m) => m.id !== tempId);
      if (withoutTemp.some((m) => m.id === (inserted as any).id)) return withoutTemp;
      return [...withoutTemp, inserted as Message];
    });
    setSending(false);
  };

  const penaltyMessage = getPenaltyMessage(violationScore, userRole);

  const languagesDiffer = !!otherUserLanguage && otherUserLanguage !== myLanguage;

  const handleTranslateMessage = async (msg: Message) => {
    // Always translate from the partner's language to the viewer's. We don't
    // detect each individual message — for chat snippets the partner's
    // profile language is a reliable signal and saves an API call.
    if (!otherUserLanguage || msg.sender_id === user?.id) return;
    if (translations[msg.id] || translatingIds.has(msg.id)) {
      // toggle off if already shown
      setTranslations((prev) => {
        if (!prev[msg.id]) return prev;
        const { [msg.id]: _, ...rest } = prev;
        return rest;
      });
      return;
    }
    setTranslatingIds((prev) => new Set(prev).add(msg.id));
    try {
      const translated = await translateText(msg.message_text, otherUserLanguage, myLanguage);
      setTranslations((prev) => ({ ...prev, [msg.id]: translated }));
    } catch (err: any) {
      console.error("[Chat] Translate failed:", err);
      toast.error(t("chat.translate_failed") || "Translation failed");
    } finally {
      setTranslatingIds((prev) => {
        const next = new Set(prev);
        next.delete(msg.id);
        return next;
      });
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="bg-card border-b border-border px-3 h-14 flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => navigate("/chat")}
          aria-label="Back"
          className="text-foreground p-2 -ml-2 flex items-center justify-center flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button
          onClick={() => otherUserId && navigate(`/profile/${otherUserId}`)}
          disabled={!otherUserId}
          className="flex items-center gap-2 flex-1 min-w-0 text-left disabled:cursor-default"
        >
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center overflow-hidden flex-shrink-0">
            {otherUserAvatar ? (
              <img src={otherUserAvatar} alt={otherUserName || "User"} className="w-full h-full object-cover" />
            ) : (
              <span className="text-primary-foreground text-sm font-semibold">
                {(otherUserName || "?").charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <span className="font-semibold text-foreground flex-1 truncate text-sm hover:text-primary flex items-center gap-1">
            <span className="truncate">{otherUserName || t("chat.conversation")}</span>
            {otherUserLanguage && (
              <span
                className="text-xs flex-shrink-0"
                title={LANGUAGE_LABELS[otherUserLanguage]}
                aria-label={LANGUAGE_LABELS[otherUserLanguage]}
              >
                {LANGUAGE_FLAGS[otherUserLanguage]}
              </span>
            )}
          </span>
        </button>
        {isPreAcceptance && (
          <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0">
            <Lock className="w-2.5 h-2.5" /> {t("chat.contacts_locked")}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {/* Platform safety notice */}
        <div className="mb-3">
          <PlatformWarningBanner
            role={userRole}
            violationScore={violationScore}
            variant={isPreAcceptance ? "info" : undefined}
          />
        </div>

        {/* Pre-acceptance limited communication notice */}
        {isPreAcceptance && (
          <div className="bg-accent rounded-xl p-3 mb-3 flex items-start gap-2">
            <Shield className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">{t("chat.pre_acceptance_notice")}</p>
          </div>
        )}

        {/* Different-language banner */}
        {languagesDiffer && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 mb-3 flex items-start gap-2">
            <Languages className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-xs text-foreground">
              <span className="font-semibold">
                {t("chat.translate_banner_title") || "Different languages"}{" "}
                {LANGUAGE_FLAGS[myLanguage]} ↔ {LANGUAGE_FLAGS[otherUserLanguage!]}
              </span>
              <br />
              <span className="text-muted-foreground">
                {t("chat.translate_banner_desc") ||
                  "Tap any of their messages to translate it to your language."}
              </span>
            </p>
          </div>
        )}

        {/* Penalty warning */}
        {penaltyMessage && violationScore >= 3 && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 mb-3">
            <p className="text-xs text-destructive font-medium flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {penaltyMessage}
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const isMine = msg.sender_id === user?.id;
          const displayText = isPreAcceptance ? maskContactInfo(msg.message_text) : msg.message_text;
          const translation = translations[msg.id];
          const isTranslating = translatingIds.has(msg.id);
          const canTranslate = languagesDiffer && !isMine;
          return (
            <div key={msg.id} className={`flex my-1 ${isMine ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[75%] flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => canTranslate && handleTranslateMessage(msg)}
                  disabled={!canTranslate}
                  className={`px-4 py-2 rounded-2xl text-sm break-words text-left ${
                    isMine
                      ? "bg-primary text-primary-foreground rounded-br-md cursor-default"
                      : `bg-lavender-100 text-foreground rounded-bl-md ${canTranslate ? "cursor-pointer hover:bg-lavender-200 transition-colors" : "cursor-default"}`
                  }`}
                >
                  {displayText}
                </button>
                {isTranslating && (
                  <div className="flex items-center gap-1 px-2 text-[11px] text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {t("chat.translating") || "Translating…"}
                  </div>
                )}
                {translation && (
                  <div className="bg-primary/5 border border-primary/20 rounded-xl px-3 py-2 text-xs text-foreground">
                    <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-primary font-semibold mb-0.5">
                      <Languages className="w-3 h-3" />
                      {LANGUAGE_FLAGS[myLanguage]} {t("chat.translation") || "Translation"}
                    </div>
                    {isPreAcceptance ? maskContactInfo(translation) : translation}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {otherTyping && (
          <div className="flex justify-start">
            <div className="bg-card shadow-card rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {contactWarning && (
        <div className="bg-destructive/10 px-4 py-2 text-xs text-destructive flex items-center gap-2">
          <AlertTriangle className="w-3 h-3" />
          {warningCount >= 2
            ? t("protection.repeated_violation")
            : t("chat.contacts_unlock")
          }
        </div>
      )}

      <div className="bg-card border-t border-border px-4 py-3 flex gap-2">
        <Input value={newMsg} onChange={(e) => handleInputChange(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder={isPreAcceptance ? t("chat.limited_placeholder") : t("chat.type_message")}
          className="rounded-full h-10 bg-accent border-0" />
        <button onClick={sendMessage} disabled={sending || !newMsg.trim()}
          className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center flex-shrink-0 disabled:opacity-50">
          <Send className="w-4 h-4 text-primary-foreground" />
        </button>
      </div>
    </div>
  );
}

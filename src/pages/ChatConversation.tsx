import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Send, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Message {
  id: string;
  sender_id: string;
  message_text: string;
  created_at: string;
}

// Anti-bypass: detect phone numbers, emails, WhatsApp mentions
const CONTACT_PATTERNS = [
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,          // phone numbers
  /\(\d{3}\)\s?\d{3}[-.\s]?\d{4}/,                // (xxx) xxx-xxxx
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // emails
  /whatsapp/i, /telegram/i, /signal/i,
  /\+\d{1,3}\s?\d{4,}/,                           // international phone
  /venmo/i, /cashapp/i, /zelle/i, /paypal/i,
];

function containsContactInfo(text: string): boolean {
  return CONTACT_PATTERNS.some(pattern => pattern.test(text));
}

function maskContactInfo(text: string): string {
  let masked = text;
  // Mask phone numbers
  masked = masked.replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "***-***-****");
  masked = masked.replace(/\(\d{3}\)\s?\d{3}[-.\s]?\d{4}/g, "(***) ***-****");
  masked = masked.replace(/\+\d{1,3}\s?\d{4,}/g, "+** ****");
  // Mask emails
  masked = masked.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "****@****.***");
  return masked;
}

export default function ChatConversation() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [contactWarning, setContactWarning] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    fetchMessages();
    checkPaymentStatus();

    const channel = supabase
      .channel(`messages-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const checkPaymentStatus = async () => {
    // Check if the job associated with this conversation has been paid (status >= hired)
    const { data: conv } = await supabase.from("conversations").select("job_id").eq("id", id!).single();
    if (conv?.job_id) {
      const { data: job } = await supabase.from("jobs").select("status").eq("id", conv.job_id).single();
      if (job && ["in_progress", "completed"].includes(job.status)) {
        setIsPaid(true);
      }
    }
  };

  const fetchMessages = async () => {
    const { data } = await supabase.from("messages").select("*").eq("conversation_id", id!).order("created_at", { ascending: true });
    setMessages((data as Message[]) || []);
  };

  const sendMessage = async () => {
    if (!newMsg.trim() || !user || !id) return;

    // Anti-bypass check
    if (containsContactInfo(newMsg) && !isPaid) {
      setContactWarning(true);
      toast.error("Contact details are blocked until booking is confirmed through Shinely.");
      return;
    }

    setSending(true);
    await supabase.from("messages").insert({ conversation_id: id, sender_id: user.id, message_text: newMsg.trim() });
    setNewMsg("");
    setSending(false);
    setContactWarning(false);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate("/chat")} className="text-foreground"><ArrowLeft className="w-5 h-5" /></button>
        <h2 className="font-semibold text-foreground flex-1">Conversation</h2>
        {!isPaid && (
          <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Contacts locked</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {!isPaid && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700">Contact details unlock after booking through Shinely. Sharing contact info before payment is not allowed.</p>
          </div>
        )}
        {messages.map((msg) => {
          const isMine = msg.sender_id === user?.id;
          const displayText = isPaid ? msg.message_text : maskContactInfo(msg.message_text);
          return (
            <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${
                isMine ? "gradient-primary text-primary-foreground rounded-br-md" : "bg-card shadow-card text-foreground rounded-bl-md"
              }`}>
                {displayText}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {contactWarning && (
        <div className="bg-destructive/10 px-4 py-2 text-xs text-destructive flex items-center gap-2">
          <AlertTriangle className="w-3 h-3" />
          Contact details unlock after booking through Shinely
        </div>
      )}

      <div className="bg-card border-t border-border px-4 py-3 flex gap-2">
        <Input value={newMsg} onChange={(e) => setNewMsg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Type a message..." className="rounded-full h-10 bg-accent border-0" />
        <button onClick={sendMessage} disabled={sending || !newMsg.trim()}
          className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center flex-shrink-0 disabled:opacity-50">
          <Send className="w-4 h-4 text-primary-foreground" />
        </button>
      </div>
    </div>
  );
}

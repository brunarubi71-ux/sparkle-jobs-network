import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Sparkles, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

type ChatLang = "pt" | "en" | "es";

const LANG_OPTIONS: { code: ChatLang; label: string; flag: string }[] = [
  { code: "pt", label: "Português", flag: "🇧🇷" },
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "es", label: "Español", flag: "🇪🇸" },
];

const LANG_QUESTION = "👋 Olá! / Hi! / ¡Hola!\n\nEm qual idioma posso te ajudar?\nWhich language can I help you?\n¿En qué idioma puedo ayudarte?";

const GREETING: Record<ChatLang, string> = {
  pt: "Olá! Sou a assistente do Shinely Jobs 🌟 Como posso te ajudar hoje?",
  es: "¡Hola! Soy la asistente de Shinely Jobs 🌟 ¿En qué puedo ayudarte hoy?",
  en: "Hi! I'm the Shinely Jobs assistant 🌟 How can I help you today?",
};

const PLACEHOLDER: Record<ChatLang, string> = {
  pt: "Digite sua mensagem...",
  es: "Escribe tu mensaje...",
  en: "Type your message...",
};

export default function AIChatWidget() {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [chatLang, setChatLang] = useState<ChatLang | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset when closed
  const handleClose = () => {
    setOpen(false);
    setChatLang(null);
    setMessages([]);
    setInput("");
  };

  // On open: show language question
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: "assistant", content: LANG_QUESTION }]);
    }
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectLang = (lang: ChatLang) => {
    setChatLang(lang);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: LANG_OPTIONS.find(l => l.code === lang)!.flag + " " + LANG_OPTIONS.find(l => l.code === lang)!.label },
      { role: "assistant", content: GREETING[lang] },
    ]);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading || !chatLang) return;
    setInput("");

    const userMsg: Message = { role: "user", content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setLoading(true);

    // Filter out the language selection exchange for API context
    const apiMessages = updated.filter((m) =>
      m.content !== LANG_QUESTION &&
      !LANG_OPTIONS.some(l => m.content === l.flag + " " + l.label) &&
      !Object.values(GREETING).includes(m.content)
    );

    try {
      const { data, error } = await supabase.functions.invoke("ai-support-chat", {
        body: {
          messages: apiMessages.map((m) => ({ role: m.role, content: m.content })),
          userId: user?.id,
          userRole: profile?.role,
          language: chatLang,
        },
      });

      if (error) throw error;
      setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            chatLang === "pt"
              ? "Desculpe, ocorreu um erro. Tente novamente."
              : chatLang === "es"
              ? "Lo siento, ocurrió un error. Inténtalo de nuevo."
              : "Sorry, an error occurred. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="fab"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-20 right-4 z-50 w-14 h-14 rounded-full gradient-primary shadow-lg flex items-center justify-center text-white"
            aria-label="Open support chat"
          >
            <Sparkles className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ y: 20, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="fixed bottom-24 right-4 z-50 bg-background rounded-3xl shadow-2xl flex flex-col w-[22rem] max-w-[calc(100vw-2rem)]"
            style={{ maxHeight: "70vh" }}
          >
            {/* Header */}
            <div className="gradient-primary px-4 py-3 rounded-t-3xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-white text-sm">Shinely Support ✨</p>
                <p className="text-white/70 text-[11px]">
                  {chatLang === "pt" ? "Assistente IA • Online" : chatLang === "es" ? "Asistente IA • En línea" : "AI Assistant • Online"}
                </p>
              </div>
              <button onClick={handleClose} className="text-white/70 hover:text-white transition-colors p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.role === "assistant" && (
                    <div className="w-6 h-6 rounded-full gradient-primary flex items-center justify-center mr-2 mt-1 shrink-0">
                      <Sparkles className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line ${
                      m.role === "user"
                        ? "gradient-primary text-white rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}

              {/* Language picker buttons */}
              {!chatLang && messages.length > 0 && (
                <div className="flex justify-start">
                  <div className="w-6 h-6 mr-2 shrink-0" />
                  <div className="flex flex-col gap-2">
                    {LANG_OPTIONS.map((l) => (
                      <button
                        key={l.code}
                        onClick={() => selectLang(l.code)}
                        className="flex items-center gap-2 px-4 py-2 rounded-2xl border-2 border-primary/30 bg-background hover:bg-primary/5 hover:border-primary text-sm font-medium transition-all text-left"
                      >
                        <span className="text-base">{l.flag}</span>
                        <span>{l.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {loading && (
                <div className="flex justify-start">
                  <div className="w-6 h-6 rounded-full gradient-primary flex items-center justify-center mr-2 shrink-0">
                    <Sparkles className="w-3 h-3 text-white" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input — only shown after language is chosen */}
            {chatLang && (
              <div className="px-3 py-3 border-t border-border bg-card flex gap-2 items-center">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder={PLACEHOLDER[chatLang]}
                  className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors"
                />
                <button
                  onClick={send}
                  disabled={loading || !input.trim()}
                  className="w-10 h-10 rounded-xl gradient-primary text-white flex items-center justify-center disabled:opacity-40 transition-opacity shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

import { useEffect, useState } from "react";
import { AlertCircle, RefreshCw, X } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { supabase } from "@/integrations/supabase/client";

export default function SupportAlertBanner() {
  const { notifications, markAsRead } = useNotifications();
  const [now, setNow] = useState(Date.now());

  const alert = notifications.find(
    (n) => n.type === ("support_alert" as any) && !n.read
  ) as any | undefined;

  useEffect(() => {
    if (!alert) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [alert?.id]);

  if (!alert) return null;

  const resolveAt = alert.resolve_at ? new Date(alert.resolve_at).getTime() : null;
  const msLeft = resolveAt ? Math.max(0, resolveAt - now) : null;
  const minutesLeft = msLeft !== null ? Math.ceil(msLeft / 60000) : null;
  const secondsLeft = msLeft !== null ? Math.ceil((msLeft % 60000) / 1000) : null;
  const resolved = msLeft === 0;

  const handleDismiss = () => markAsRead(alert.id);

  const handleRefresh = () => {
    markAsRead(alert.id);
    window.location.reload();
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[99999] bg-amber-500 text-white px-4 py-3 shadow-lg">
      <div className="flex items-start gap-3 max-w-lg mx-auto">
        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 animate-pulse" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">{alert.title}</p>
          <p className="text-xs mt-0.5 text-amber-100">{alert.message}</p>
          {!resolved && minutesLeft !== null && minutesLeft > 0 && (
            <p className="text-xs mt-1 font-mono font-bold text-white">
              ⏱ Atualize em {minutesLeft}:{String(secondsLeft ?? 0).padStart(2, "0")} min
            </p>
          )}
          {resolved && (
            <button
              onClick={handleRefresh}
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold underline"
            >
              <RefreshCw className="w-3 h-3" /> Atualizar agora
            </button>
          )}
        </div>
        <button onClick={handleDismiss} className="flex-shrink-0 mt-0.5 opacity-80 hover:opacity-100">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Push notification registration for native mobile (Capacitor) and web (Web Push).
// Stores the FCM token in Supabase so the backend can target this device.
//
// Usage: call usePushNotifications() in App.tsx after auth loads.
// The hook is safe to call on web — it gracefully no-ops if push is unavailable.

import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

async function getPlatform(): Promise<"ios" | "android" | "web"> {
  const p = Capacitor.getPlatform();
  if (p === "ios") return "ios";
  if (p === "android") return "android";
  return "web";
}

async function registerNativePush(userId: string) {
  // Dynamically import so web builds don't break if the plugin is missing
  const { PushNotifications } = await import("@capacitor/push-notifications");

  let permStatus = await PushNotifications.checkPermissions();
  if (permStatus.receive === "prompt") {
    permStatus = await PushNotifications.requestPermissions();
  }
  if (permStatus.receive !== "granted") return;

  await PushNotifications.register();

  PushNotifications.addListener("registration", async (token) => {
    await saveToken(userId, token.value, await getPlatform());
  });

  PushNotifications.addListener("registrationError", (err) => {
    console.warn("[push] Registration error:", err);
  });
}

async function saveToken(userId: string, token: string, platform: "ios" | "android" | "web") {
  await supabase.from("push_tokens" as any).upsert(
    { user_id: userId, token, platform, active: true },
    { onConflict: "user_id,token" },
  );
}

export function usePushNotifications() {
  const { user } = useAuth();
  const registered = useRef(false);

  useEffect(() => {
    if (!user || registered.current) return;
    registered.current = true;

    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
      registerNativePush(user.id).catch((err) =>
        console.warn("[push] Native registration failed:", err),
      );
    }
    // Web push registration would go here if VAPID keys are configured.
    // For now, in-app realtime notifications handle the web case.
  }, [user]);
}

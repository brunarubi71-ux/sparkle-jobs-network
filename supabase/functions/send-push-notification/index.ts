// Push notification sender using Firebase Cloud Messaging (FCM) HTTP v1 API.
// Called from DB triggers via pg_net when a notification row is inserted.
//
// Required env vars (set in Supabase Dashboard → Settings → Edge Functions → Secrets):
//   FIREBASE_PROJECT_ID       - from Firebase console project settings
//   FIREBASE_SERVICE_ACCOUNT  - JSON of the Firebase service account key (stringify the JSON)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const FIREBASE_PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") ?? "";
const FIREBASE_SERVICE_ACCOUNT_RAW = Deno.env.get("FIREBASE_SERVICE_ACCOUNT") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── FCM OAuth2 token via service account ────────────────────────────────────

async function getFCMAccessToken(serviceAccount: Record<string, string>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const signingInput = `${encode(header)}.${encode(payload)}`;

  // Import the RSA private key
  const keyPem = serviceAccount.private_key.replace(/\\n/g, "\n");
  const keyDer = pemToDer(keyPem);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const jwt = `${signingInput}.${signatureB64}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Failed to get FCM OAuth token: ${err}`);
  }

  const { access_token } = await tokenRes.json();
  return access_token;
}

function pemToDer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// ─── Send one push notification via FCM HTTP v1 ──────────────────────────────

async function sendFCMNotification(
  token: string,
  title: string,
  body: string,
  data: Record<string, string>,
  accessToken: string,
): Promise<void> {
  const url = `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`;

  const message = {
    message: {
      token,
      notification: { title, body },
      data,
      android: {
        notification: {
          channel_id: "shinely_default",
          priority: "HIGH",
          color: "#A855F7",
          click_action: "FLUTTER_NOTIFICATION_CLICK",
        },
      },
      apns: {
        headers: { "apns-priority": "10" },
        payload: {
          aps: {
            alert: { title, body },
            badge: 1,
            sound: "default",
          },
        },
      },
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  if (!res.ok) {
    const err = await res.text();
    // Token expired/invalid — caller should clean it up
    if (res.status === 404 || err.includes("UNREGISTERED")) {
      throw new Error("UNREGISTERED_TOKEN");
    }
    throw new Error(`FCM error ${res.status}: ${err}`);
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  // Check Firebase is configured
  if (!FIREBASE_PROJECT_ID || !FIREBASE_SERVICE_ACCOUNT_RAW) {
    console.warn("[send-push] Firebase not configured — skipping push notification");
    return new Response(
      JSON.stringify({ success: false, reason: "Firebase not configured" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let serviceAccount: Record<string, string>;
  try {
    serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT_RAW);
  } catch {
    console.error("[send-push] Invalid FIREBASE_SERVICE_ACCOUNT JSON");
    return new Response(
      JSON.stringify({ error: "Invalid service account configuration" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let body: { userId: string; title: string; message: string; data?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const { userId, title, message, data = {} } = body;
  if (!userId || !title || !message) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: userId, title, message" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Fetch all active push tokens for this user
  const { data: tokens } = await supabase
    .from("push_tokens")
    .select("id, token, platform")
    .eq("user_id", userId)
    .eq("active", true);

  if (!tokens?.length) {
    return new Response(
      JSON.stringify({ success: true, sent: 0, reason: "No push tokens for user" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let accessToken: string;
  try {
    accessToken = await getFCMAccessToken(serviceAccount);
  } catch (err) {
    console.error("[send-push] OAuth token error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to authenticate with Firebase" }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let sent = 0;
  const staleTokenIds: string[] = [];

  await Promise.allSettled(
    tokens.map(async (t) => {
      try {
        await sendFCMNotification(t.token, title, message, data, accessToken);
        sent++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === "UNREGISTERED_TOKEN") {
          staleTokenIds.push(t.id);
        } else {
          console.error(`[send-push] Failed for token ${t.id}:`, msg);
        }
      }
    }),
  );

  // Deactivate stale tokens so we don't waste calls on them
  if (staleTokenIds.length > 0) {
    await supabase
      .from("push_tokens")
      .update({ active: false })
      .in("id", staleTokenIds);
  }

  console.log(`[send-push] userId=${userId} sent=${sent} stale=${staleTokenIds.length}`);

  return new Response(
    JSON.stringify({ success: true, sent, staleRemoved: staleTokenIds.length }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

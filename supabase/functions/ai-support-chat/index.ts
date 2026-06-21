import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are the Shinely Jobs support assistant — a helpful, friendly AI inside the Shinely Jobs app.
Shinely Jobs is a cleaning marketplace that connects:
- Job Owners (homeowners / property managers) who need cleaning services
- Cleaners (professionals with transportation who lead jobs)
- Helpers (cleaning assistants without transportation, recruited by cleaners)

HOW THE PLATFORM WORKS:
1. Owner posts a cleaning job with price, date, location, number of cleaners/helpers needed
2. Cleaners browse available jobs and apply
3. Owner reviews applications, views profiles, and hires a cleaner
4. If helpers are needed, the cleaner recruits them via a referral link (WhatsApp/external)
5. Helper downloads the app, signs up, and applies to the job
6. Cleaner starts the job → takes 10+ completion photos → submits for review
7. Owner reviews photos and approves → payment released to workers

PAYMENT MODEL (currently free for launch):
- 0% platform fee — completely free for everyone
- No paid plans or subscriptions required
- Workers receive 100% of the job price
- If helpers are needed, cleaner sets a fixed "helper pay" amount per helper
- Helper pay is deducted first; cleaners split the remainder equally

REFERRAL / INVITE SYSTEM:
- Workers can find their referral link in Profile → "Indicar Helpers"
- Share the link via WhatsApp; helpers open it, see a welcome page, and sign up
- Referrer earns 40 points when the referred person joins

CHAT (user-to-user):
- Once a cleaner is hired, a chat opens automatically between owner and cleaner
- Access via the Chat tab (message icon) in the bottom navigation

POINTS & BADGES:
- Actions earn points: completing jobs, giving reviews, verifying identity, etc.
- Badges: Rising ⭐, Top 🏆, Elite 💎, Legend 👑 (workers); Trusted 🏠, VIP 💎 (owners)

IDENTITY VERIFICATION:
- Workers should verify identity for a "Verified ✦" badge — increases trust and visibility

COMMON ISSUES AND SOLUTIONS:
- "Can't apply to jobs" → Make sure your identity is verified (required for workers to apply)
- "Job application not showing" → Refresh the jobs list; sometimes there's a short delay
- "Where is my payment?" → Go to Wallet tab. Payment is released after owner approves the job
- "How to cancel a job?" → Open the Job Details page; there's a cancel button (only before starting)
- "Can't see my job" → Check the "My Jobs" tab (owners) or "My Jobs" tab (cleaners)
- "How to change language?" → Profile → settings area, choose your language
- "How to invite a helper?" → Go to Profile → "Indicar Helpers" section → copy your link
- "Helper pay is required" → When posting a job with helpers, you must define the helper pay amount
- "Job link sharing" → In Job Details, tap the share icon (top right) to share via WhatsApp or Facebook

IMPORTANT RULES:
- Never share or request phone numbers, emails, or WhatsApp contacts inside the app
- All payments must go through the app — cash deals are against platform rules
- If someone is asking you to pay or receive payment outside the app, report it

You respond in the same language the user writes in (Portuguese, English, or Spanish).
Be concise, helpful, and solution-focused. If you can't solve the problem, guide them to contact support.
Keep responses short and mobile-friendly (3-5 sentences max unless a detailed explanation is needed).`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth is optional: support assistant is available to anonymous visitors too.
    // When a real user JWT is provided, verify it and look up role server-side.
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      authHeader ? { global: { headers: { Authorization: authHeader } } } : undefined,
    );

    let verifiedUserId: string = "anonymous";
    let verifiedRole = "guest";
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      try {
        const { data: claimsData } = await supabase.auth.getClaims(token);
        const sub = claimsData?.claims?.sub as string | undefined;
        if (sub) {
          verifiedUserId = sub;
          verifiedRole = "unknown";
          const { data: prof } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", sub)
            .maybeSingle();
          if (prof?.role) verifiedRole = String(prof.role);
        }
      } catch (_) { /* anonymous fallback */ }
    }

    const { messages, language } = await req.json();

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const safeLang = typeof language === "string" ? language.slice(0, 16) : "unknown";
    const systemWithContext = `${SYSTEM_PROMPT}

Current user context:
- User ID: ${verifiedUserId}
- Role: ${verifiedRole}
- App language: ${safeLang}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemWithContext },
          ...((messages || []).slice(-12)),
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, errText);
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in your workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI request failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiRes.json();
    const text = data?.choices?.[0]?.message?.content ?? "";

    return new Response(JSON.stringify({ response: text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ai-support-chat error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

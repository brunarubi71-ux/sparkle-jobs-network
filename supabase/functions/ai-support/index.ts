import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Anthropic from "npm:@anthropic-ai/sdk@0.36.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SYSTEM_PROMPT = `You are Shinely Assistant, the friendly support bot for Shinely — a cleaning job marketplace that connects professional cleaners with homeowners in the US.

KEY FACTS ABOUT SHINELY:
- Cleaners keep 90% of each payment; Shinely takes a 10% platform fee only when a job is completed
- Homeowners pay the cleaner's price plus a 10% platform fee (e.g. $100 job → homeowner pays $110)
- Payments are held in escrow until the homeowner confirms the job is done
- Instant payouts: cleaners receive payment ~30 minutes after job completion is confirmed
- Cleaners can filter jobs by distance: 5, 10, 25, or 50 miles
- Helpers earn 30% of a job by teaming up with a cleaner (great for people without a car)
- All payments are processed securely through Stripe — no cash needed
- Users can rate and review each other after every job
- Cleaners build reputation through ratings and badges
- Identity verification is required for homeowners before posting jobs
- The app is available on iOS and Android

WHAT SHINELY DOES NOT DO:
- We cannot share another user's personal contact info
- We do not handle disputes by phone — disputes are filed inside the app
- We cannot process refunds directly — refunds go through the dispute system
- We cannot manually change prices after a job is created

HOW TO USE SHINELY:
- Cleaners: Sign up → complete profile → browse jobs → apply → get hired → complete job → get paid
- Homeowners: Sign up → verify identity → post job → receive applications → hire cleaner → confirm completion → payment released

Be concise, warm, and helpful. If you don't know the answer, say so honestly and suggest the user contact support at support@shinelyapp.com. Never make up information. Answer in the same language the user writes in (English or Portuguese).`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) return json(500, { error: "AI not configured" });

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json(400, { error: "Invalid JSON" });
    }

    const userMessage = typeof body.message === "string" ? body.message.trim() : "";
    const history = Array.isArray(body.history) ? body.history : [];

    if (!userMessage) return json(400, { error: "Message is required" });
    if (userMessage.length > 1000) return json(400, { error: "Message too long" });

    // Build messages array from history (max last 6 turns to keep cost low)
    const recentHistory = history.slice(-6);
    const messages: Anthropic.MessageParam[] = [
      ...recentHistory.map((turn: any) => ({
        role: (turn.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
        content: String(turn.content || ""),
      })),
      { role: "user" as const, content: userMessage },
    ];

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages,
    });

    const reply = response.content[0].type === "text" ? response.content[0].text : "";

    return json(200, { reply });
  } catch (error) {
    console.error("[ai-support] error:", error);
    return json(500, { error: "Support is temporarily unavailable. Please try again shortly." });
  }
});

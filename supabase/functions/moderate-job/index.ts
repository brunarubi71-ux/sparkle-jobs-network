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

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const city = typeof body.city === "string" ? body.city.trim() : "";

    if (!title) return json(400, { error: "Title is required" });

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: `You are a content moderator for Shinely, a cleaning job marketplace. Review this job posting and respond with a JSON object only.

Job title: ${title}
City: ${city || "not specified"}
Description: ${description || "no description provided"}

Check for:
1. Contact information (phone numbers, emails, social media handles, WhatsApp numbers)
2. Requests to pay outside the platform
3. Offensive, discriminatory, or inappropriate content
4. Spam or fake listings
5. Illegal activity

Respond with ONLY this JSON (no markdown, no explanation):
{"approved": true/false, "reason": "short reason if rejected, empty string if approved", "severity": "none/low/high"}`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : "";

    let result: { approved: boolean; reason: string; severity: string };
    try {
      result = JSON.parse(text);
    } catch {
      // If parsing fails, default to approved to avoid blocking legitimate posts
      result = { approved: true, reason: "", severity: "none" };
    }

    return json(200, {
      approved: Boolean(result.approved),
      reason: String(result.reason || ""),
      severity: String(result.severity || "none"),
    });
  } catch (error) {
    console.error("[moderate-job] error:", error);
    // On any error, default to approved so AI issues don't block posting
    return json(200, { approved: true, reason: "", severity: "none" });
  }
});

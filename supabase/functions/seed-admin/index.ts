// Bootstrap utility for the very first admin account.
// Protected by a shared secret so it cannot be invoked by anonymous callers.
// Required env vars (set in Supabase function config, never in client code):
//   ADMIN_SEED_SECRET   – shared bearer token sent in the Authorization header
//   ADMIN_SEED_EMAIL    – the email to grant admin to
//   ADMIN_SEED_PASSWORD – initial password (change immediately after first login)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ADMIN_SEED_SECRET = Deno.env.get("ADMIN_SEED_SECRET");
  const ADMIN_SEED_EMAIL = Deno.env.get("ADMIN_SEED_EMAIL");
  const ADMIN_SEED_PASSWORD = Deno.env.get("ADMIN_SEED_PASSWORD");

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return json(500, { error: "Server is not configured" });
  }
  if (!ADMIN_SEED_SECRET || !ADMIN_SEED_EMAIL || !ADMIN_SEED_PASSWORD) {
    return json(503, { error: "Admin seeding is disabled" });
  }

  // Require an "Authorization: Bearer <ADMIN_SEED_SECRET>" header.
  const auth = req.headers.get("Authorization") || "";
  const provided = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  if (!provided || provided !== ADMIN_SEED_SECRET) {
    return json(401, { error: "Unauthorized" });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((u: { email?: string }) => u.email === ADMIN_SEED_EMAIL);

    let userId: string;

    if (existing) {
      userId = existing.id;
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: ADMIN_SEED_PASSWORD,
        email_confirm: true,
      });
    } else {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: ADMIN_SEED_EMAIL,
        password: ADMIN_SEED_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: "Admin" },
      });
      if (error) throw error;
      userId = data.user.id;
    }

    await supabaseAdmin
      .from("profiles")
      .update({ role: "admin", full_name: "Admin" })
      .eq("id", userId);

    return json(200, { success: true, userId });
  } catch (err) {
    return json(500, { error: (err as Error).message });
  }
});

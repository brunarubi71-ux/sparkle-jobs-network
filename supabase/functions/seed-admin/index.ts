// TEMP ADMIN USER - Remove before production
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const EMAIL = "admin@shinely.com";
  const PASSWORD = "123456";

  try {
    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((u: any) => u.email === EMAIL);

    let userId: string;

    if (existing) {
      userId = existing.id;
      // Update password in case it changed
      await supabaseAdmin.auth.admin.updateUserById(userId, { password: PASSWORD, email_confirm: true });
    } else {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: EMAIL,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: "Admin" },
      });
      if (error) throw error;
      userId = data.user.id;
    }

    // Set role to admin
    await supabaseAdmin.from("profiles").update({ role: "admin", full_name: "Admin" }).eq("id", userId);

    return new Response(JSON.stringify({ success: true, userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

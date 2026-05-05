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

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return json(500, { error: "Server is not configured" });
  }

  // Authenticate the caller
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json(401, { error: "Missing authorization header" });
  }

  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const userClient = createClient(SUPABASE_URL, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return json(401, { error: "Invalid token" });
  }

  const userId = claimsData.claims.sub as string;
  if (!userId) return json(401, { error: "Invalid token" });

  // Use service role client for deletions
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    // Delete user data from all related tables (order matters for FK constraints)
    const tables = [
      { table: "point_history", column: "user_id" },
      { table: "disputes", column: "reporter_id" },
      { table: "team_invites", column: "invited_by" },
      { table: "team_members", column: "user_id" },
      { table: "portfolio_photos", column: "user_id" },
      { table: "platform_violations", column: "user_id" },
      { table: "notifications", column: "user_id" },
      { table: "wallet_transactions", column: "user_id" },
      { table: "rewards", column: "user_id" },
      { table: "reviews", column: "reviewer_id" },
      { table: "reviews", column: "reviewed_id" },
      { table: "subscriptions", column: "user_id" },
      { table: "messages", column: "sender_id" },
      { table: "conversations", column: "owner_id" },
      { table: "conversations", column: "cleaner_id" },
      { table: "job_cancellations", column: "cancelled_by" },
      { table: "job_private_details", column: "job_id" }, // handled via jobs
      { table: "helper_applications", column: "applicant_id" },
      { table: "job_applications", column: "cleaner_id" },
      { table: "schedules", column: "owner_id" },
    ];

    const errors: string[] = [];

    for (const { table, column } of tables) {
      const { error } = await admin.from(table).delete().eq(column, userId);
      if (error) errors.push(`${table}: ${error.message}`);
    }

    // Update jobs: remove hired_cleaner_id references
    await admin
      .from("jobs")
      .update({ hired_cleaner_id: null, status: "open" })
      .eq("hired_cleaner_id", userId);

    // Delete jobs owned by user (first delete related private details)
    const { data: ownedJobs } = await admin
      .from("jobs")
      .select("id")
      .eq("owner_id", userId);

    if (ownedJobs && ownedJobs.length > 0) {
      const jobIds = ownedJobs.map((j: { id: string }) => j.id);
      await admin.from("job_private_details").delete().in("job_id", jobIds);
      await admin.from("job_applications").delete().in("job_id", jobIds);
      await admin.from("job_cancellations").delete().in("job_id", jobIds);
      await admin.from("job_payouts").delete().in("job_id", jobIds);
    }
    await admin.from("jobs").delete().eq("owner_id", userId);

    // Delete profile
    await admin.from("profiles").delete().eq("id", userId);

    // Delete auth user
    const { error: authError } = await admin.auth.admin.deleteUser(userId);
    if (authError) {
      return json(500, { error: `Failed to delete auth user: ${authError.message}`, warnings: errors });
    }

    return json(200, {
      success: true,
      message: "Account deleted successfully",
      warnings: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    return json(500, { error: (err as Error).message });
  }
});

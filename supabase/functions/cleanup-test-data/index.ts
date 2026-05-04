// One-time cleanup utility: wipes all test data from the database while
// preserving the admin user.  Protected by ADMIN_SEED_SECRET.
//
// Required env vars (auto-set by Supabase):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
// Required env var (set in Lovable Cloud secrets):
//   ADMIN_SEED_SECRET — bearer token used to authorize the call
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

const ADMIN_EMAIL = "admin@shinelyapp.com";

const TABLES_TO_WIPE = [
  "point_history",
  "disputes",
  "team_invites",
  "team_members",
  "portfolio_photos",
  "platform_violations",
  "notifications",
  "wallet_transactions",
  "webhook_events",
  "rewards",
  "reviews",
  "schedules",
  "subscriptions",
  "messages",
  "conversations",
  "job_cancellations",
  "job_private_details",
  "job_payouts",
  "helper_applications",
  "job_applications",
  "jobs",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ADMIN_SEED_SECRET = Deno.env.get("ADMIN_SEED_SECRET");

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return json(500, { error: "Server is not configured" });
  }
  if (!ADMIN_SEED_SECRET) {
    return json(503, { error: "Cleanup is disabled (no secret configured)" });
  }

  const auth = req.headers.get("Authorization") || "";
  const provided = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  if (!provided || provided !== ADMIN_SEED_SECRET) {
    return json(401, { error: "Unauthorized" });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const report: Record<string, unknown> = { tables: {}, users_deleted: 0, admin_reset: false };

  try {
    // Step 1 — Wipe transactional tables.  Use raw SQL via rpc to avoid
    // having to filter out anything; we want all rows gone.
    for (const table of TABLES_TO_WIPE) {
      const { error, count } = await admin
        .from(table)
        .delete({ count: "exact" })
        .gte("created_at", "1900-01-01");
      if (error) {
        // Some tables may not have created_at — fall back to non-conditional delete
        const { error: e2, count: c2 } = await admin
          .from(table)
          .delete({ count: "exact" })
          .not("id", "is", null);
        if (e2) {
          report.tables[table] = { error: e2.message };
        } else {
          report.tables[table] = { deleted: c2 ?? 0 };
        }
      } else {
        report.tables[table] = { deleted: count ?? 0 };
      }
    }

    // Step 2 — Find admin user id, delete every other auth.user.
    const { data: adminProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("email", ADMIN_EMAIL)
      .maybeSingle();

    if (!adminProfile?.id) {
      return json(500, { error: `Admin user ${ADMIN_EMAIL} not found in profiles`, report });
    }
    const adminId = adminProfile.id as string;

    // Page through auth.users via admin API and delete each non-admin
    let page = 1;
    const perPage = 100;
    let deleted = 0;
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) {
        return json(500, { error: `listUsers failed: ${error.message}`, report });
      }
      const users = data?.users ?? [];
      if (users.length === 0) break;

      for (const u of users) {
        if (u.id === adminId) continue;
        const { error: delErr } = await admin.auth.admin.deleteUser(u.id, true);
        if (!delErr) deleted++;
      }

      if (users.length < perPage) break;
      page++;
      if (page > 50) break; // safety cap (5000 users)
    }
    report.users_deleted = deleted;

    // Step 3 — Reset admin profile counters (only update columns that exist).
    const adminResetPayload: Record<string, unknown> = {
      jobs_used_today: 0,
      free_contacts_used: 0,
      jobs_completed: 0,
      total_earnings: 0,
      wallet_balance: 0,
      helper_earnings: 0,
      violation_score: 0,
      visibility_penalty: 1.0,
      is_premium: false,
      premium_status: null,
      free_trial_started_at: null,
      free_trial_ends_at: null,
    };

    const { error: updErr } = await admin
      .from("profiles")
      .update(adminResetPayload)
      .eq("id", adminId);

    if (updErr) {
      // Try a minimal subset if the full payload was rejected (column missing).
      const minimal = {
        jobs_used_today: 0,
        free_contacts_used: 0,
        jobs_completed: 0,
        total_earnings: 0,
      };
      const { error: minErr } = await admin
        .from("profiles")
        .update(minimal)
        .eq("id", adminId);
      report.admin_reset = !minErr;
      if (minErr) report.admin_reset_error = minErr.message;
    } else {
      report.admin_reset = true;
    }

    return json(200, { success: true, report });
  } catch (err) {
    return json(500, { error: (err as Error).message, report });
  }
});

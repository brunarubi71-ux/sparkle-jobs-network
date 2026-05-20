import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    if (!SUPABASE_URL) {
      throw new Error("SUPABASE_URL is not configured");
    }

    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    if (!SUPABASE_ANON_KEY) {
      throw new Error("SUPABASE_ANON_KEY is not configured");
    }

    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
    }

    const authorization = req.headers.get("Authorization");
    if (!authorization) {
      return new Response(JSON.stringify({ success: false, error: "Not authenticated." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authorization } },
    });

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Session expired. Please sign in again." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const jobId = body?.jobId;

    if (!jobId || typeof jobId !== "string") {
      return new Response(JSON.stringify({ success: false, error: "Job ID is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, role, plan_tier, jobs_used_today, jobs_used_date, worker_type, identity_status")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      throw new Error("Cleaner profile could not be loaded.");
    }

    if (profile.role !== "cleaner") {
      return new Response(JSON.stringify({ success: false, error: "Only cleaners can accept jobs." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (profile.identity_status !== "approved") {
      return new Response(JSON.stringify({ success: false, error: "Please complete identity verification before applying to jobs." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Weekly job limits: count confirmed (accepted/hired) applications this week ──
    const today = new Date();
    const todayIso = today.toISOString().slice(0, 10);
    const day = today.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    const weekStartDate = new Date(today);
    weekStartDate.setUTCDate(today.getUTCDate() + diff);
    const weekStartIso = weekStartDate.toISOString().slice(0, 10);

    const { count: confirmedThisWeek } = await admin
      .from("job_applications")
      .select("id", { count: "exact", head: true })
      .eq("cleaner_id", user.id)
      .in("status", ["accepted", "hired"])
      .gte("created_at", weekStartIso);

    const usedThisWeek = confirmedThisWeek ?? 0;
    const tier = profile.plan_tier ?? "free";
    const maxJobsPerWeek =
      tier === "premium" ? Number.POSITIVE_INFINITY : tier === "pro" ? 7 : 2;

    if (Number.isFinite(maxJobsPerWeek) && usedThisWeek >= maxJobsPerWeek) {
      return new Response(JSON.stringify({ success: false, error: "Weekly job limit reached. Upgrade your plan for more jobs." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the job exists and is still open
    const { data: jobRow, error: jobError } = await admin
      .from("jobs")
      .select("id, owner_id, status, hired_cleaner_id, urgency, team_size_required, cleaners_required, helpers_required")
      .eq("id", jobId)
      .maybeSingle();

    if (jobError) {
      throw new Error(`Could not load job: ${jobError.message}`);
    }

    if (!jobRow) {
      return new Response(JSON.stringify({ success: false, error: "This job no longer exists." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanersRequired = Math.max(0, jobRow.cleaners_required ?? 1);
    const helpersRequired = Math.max(0, jobRow.helpers_required ?? 0);
    const totalRequired = Math.max(1, cleanersRequired + helpersRequired);
    const isTeamJob = totalRequired >= 2;
    const workerType = (profile as any).worker_type === "helper" ? "helper" : "cleaner";

    // Helpers can only apply if helpers are needed
    if (workerType === "helper" && helpersRequired < 1) {
      return new Response(JSON.stringify({ success: false, error: "This job does not need a Helper." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Cleaners can only apply if cleaners are needed
    if (workerType === "cleaner" && cleanersRequired < 1) {
      return new Response(JSON.stringify({ success: false, error: "This job only needs Helpers." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // All jobs accept applications while status is open or applied.
    // For solo jobs: also block when hired_cleaner_id is already set.
    // For team jobs (helpers_required > 0): hired_cleaner_id being set is fine —
    //   the helper slot may still be open.
    const soloJobFilled = helpersRequired === 0 && !!jobRow.hired_cleaner_id;
    if (!["open", "applied"].includes(jobRow.status) || soloJobFilled) {
      return new Response(JSON.stringify({ success: false, error: "This job is no longer accepting applications." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // All applications start as pending — owner selects from the applicant pool.
    const applicationStatus = "pending";

    // Create or update the cleaner's application
    const { data: existingApplication } = await admin
      .from("job_applications")
      .select("id, status")
      .eq("job_id", jobId)
      .eq("cleaner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const isNewAcceptance = !existingApplication;

    if (existingApplication) {
      const { error: updateApplicationError } = await admin
        .from("job_applications")
        .update({ status: applicationStatus })
        .eq("id", existingApplication.id);

      if (updateApplicationError) {
        throw new Error(`Could not update application: ${updateApplicationError.message}`);
      }
    } else {
      const { error: insertApplicationError } = await admin
        .from("job_applications")
        .insert({ job_id: jobId, cleaner_id: user.id, status: applicationStatus });

      if (insertApplicationError) {
        throw new Error(`Could not create application: ${insertApplicationError.message}`);
      }
    }

    // Mark job as "applied" so the owner sees activity (first application triggers this).
    if (jobRow.status === "open") {
      await admin.from("jobs").update({ status: "applied" }).eq("id", jobId);
    }

    // Open a conversation between worker and owner so they can chat
    const { data: existingConversation } = await admin
      .from("conversations")
      .select("id")
      .eq("job_id", jobId)
      .eq("cleaner_id", user.id)
      .maybeSingle();

    if (!existingConversation) {
      const { error: insertConversationError } = await admin
        .from("conversations")
        .insert({ job_id: jobId, cleaner_id: user.id, owner_id: jobRow.owner_id });

      if (insertConversationError) {
        throw new Error(`Could not create conversation: ${insertConversationError.message}`);
      }
    }

    return new Response(JSON.stringify({ success: true, jobId, status: applicationStatus }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

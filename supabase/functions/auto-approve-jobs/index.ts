import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// TEMP: Auto-approve jobs after 24h in pending_review
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Find jobs in pending_review older than 24h with no open dispute
    const { data: jobs, error } = await supabase
      .from("jobs")
      .select("id, hired_cleaner_id, price, pending_review_at")
      .eq("status", "pending_review")
      .lt("pending_review_at", cutoff);

    if (error) {
      console.error("Query error:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    let approved = 0;
    for (const job of jobs || []) {
      // Check if there's an open dispute
      const { data: dispute } = await supabase
        .from("disputes")
        .select("id")
        .eq("job_id", job.id)
        .eq("status", "open")
        .maybeSingle();

      if (dispute) {
        console.log(`Job ${job.id} has open dispute, skipping auto-approve`);
        continue;
      }

      // Auto-approve
      const { error: updateError } = await supabase
        .from("jobs")
        .update({
          status: "completed",
          owner_confirmed_completion: true,
          escrow_status: "released",
        })
        .eq("id", job.id);

      if (!updateError) {
        approved++;
        console.log(`Auto-approved job ${job.id}`);
      }
    }

    return new Response(
      JSON.stringify({ message: `Auto-approved ${approved} jobs`, checked: jobs?.length || 0 }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Auto-approve error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});

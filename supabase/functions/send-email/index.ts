// Transactional email sender using Resend.
// Called by other Edge Functions (accept-job, admin_resolve_dispute, etc.)
// and by DB triggers via pg_net.
//
// Auth: accepts any valid Supabase JWT (service_role or user) since
// verify_jwt is enabled.  Callers supply their own service_role key
// when making internal calls from DB triggers.

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "noreply@shinely.app";
const APP_URL = Deno.env.get("APP_URL") ?? "https://shinely.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Email templates ────────────────────────────────────────────────────────

type Templates = {
  welcome: { name: string };
  job_applied: { ownerName: string; cleanerName: string; jobTitle: string };
  job_hired: { cleanerName: string; jobTitle: string };
  new_message: { recipientName: string; senderName: string; preview: string };
  dispute_opened: { userName: string; jobTitle: string; isAdmin?: boolean };
  dispute_resolved: { userName: string; jobTitle: string; resolution: string };
  identity_approved: { name: string };
  identity_rejected: { name: string };
};

type TemplateName = keyof Templates;

function buildEmail(template: TemplateName, data: Record<string, unknown>) {
  switch (template) {
    case "welcome":
      return {
        subject: "Welcome to Shinely! 🌟",
        body: `
          <h2 style="color:#1a1a1a">Welcome, ${data.name}! 👋</h2>
          <p>We're excited to have you on <strong>Shinely</strong>. Your account is ready.</p>
          <p>Browse available cleaning jobs, build your profile, and start earning today.</p>
          ${cta("Open Shinely", APP_URL)}`,
      };

    case "job_applied":
      return {
        subject: `New applicant for "${data.jobTitle}"`,
        body: `
          <h2 style="color:#1a1a1a">New Applicant 🔔</h2>
          <p>Hi <strong>${data.ownerName}</strong>,</p>
          <p><strong>${data.cleanerName}</strong> has applied for your cleaning job <strong>"${data.jobTitle}"</strong>.</p>
          <p>Review their profile and decide to hire them from your dashboard.</p>
          ${cta("View Applicants", `${APP_URL}/my-jobs`)}`,
      };

    case "job_hired":
      return {
        subject: `You've been hired! 🎉`,
        body: `
          <h2 style="color:#1a1a1a">Congratulations, ${data.cleanerName}! 🎉</h2>
          <p>You've been selected for the cleaning job <strong>"${data.jobTitle}"</strong>.</p>
          <p>Check your job details and get ready to start.</p>
          ${cta("View My Jobs", `${APP_URL}/cleaner-my-jobs`)}`,
      };

    case "new_message":
      return {
        subject: `New message from ${data.senderName}`,
        body: `
          <h2 style="color:#1a1a1a">New Message 💬</h2>
          <p>Hi <strong>${data.recipientName}</strong>,</p>
          <p>You have a new message from <strong>${data.senderName}</strong>:</p>
          <blockquote style="border-left:3px solid #7c3aed;padding:8px 16px;margin:16px 0;background:#faf5ff;border-radius:0 8px 8px 0;color:#374151;font-style:italic">
            "${String(data.preview).slice(0, 200)}${String(data.preview).length > 200 ? "…" : ""}"
          </blockquote>
          ${cta("Reply Now", `${APP_URL}/chat`)}`,
      };

    case "dispute_opened":
      if (data.isAdmin) {
        return {
          subject: `🚨 New Dispute: "${data.jobTitle}"`,
          body: `
            <h2 style="color:#dc2626">New Dispute Opened</h2>
            <p>User <strong>${data.userName}</strong> has opened a dispute for job <strong>"${data.jobTitle}"</strong>.</p>
            <p>Please review and resolve it from the admin dashboard.</p>
            ${cta("Review Dispute", `${APP_URL}/admin`)}`,
        };
      }
      return {
        subject: `Your dispute has been received`,
        body: `
          <h2 style="color:#1a1a1a">Dispute Received ✅</h2>
          <p>Hi <strong>${data.userName}</strong>,</p>
          <p>Your dispute for the job <strong>"${data.jobTitle}"</strong> has been received and is under review.</p>
          <p>Our team will get back to you within 24–48 hours.</p>`,
      };

    case "dispute_resolved":
      return {
        subject: `Your dispute has been resolved`,
        body: `
          <h2 style="color:#1a1a1a">Dispute Resolved</h2>
          <p>Hi <strong>${data.userName}</strong>,</p>
          <p>Your dispute for job <strong>"${data.jobTitle}"</strong> has been resolved.</p>
          <p><strong>Resolution:</strong> ${data.resolution}</p>
          ${cta("Check Wallet", `${APP_URL}/wallet`)}`,
      };

    case "identity_approved":
      return {
        subject: "Your identity has been verified ✅",
        body: `
          <h2 style="color:#1a1a1a">Identity Verified! ✅</h2>
          <p>Hi <strong>${data.name}</strong>,</p>
          <p>Your identity has been verified and your account is fully activated. You can now post jobs and access all platform features.</p>
          ${cta("Open Shinely", APP_URL)}`,
      };

    case "identity_rejected":
      return {
        subject: "Identity verification update",
        body: `
          <h2 style="color:#1a1a1a">Identity Verification</h2>
          <p>Hi <strong>${data.name}</strong>,</p>
          <p>We were unable to verify your identity with the documents provided. Please try again with a clear, valid government-issued ID.</p>
          ${cta("Try Again", `${APP_URL}/profile`)}`,
      };

    default:
      return null;
  }
}

function cta(label: string, url: string) {
  return `<a href="${url}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#7c3aed;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px">${label}</a>`;
}

function wrapHtml(title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f3f4f6;margin:0;padding:24px 16px">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 1px 4px rgba(0,0,0,.08)">
    <div style="margin-bottom:28px">
      <span style="font-size:22px;font-weight:800;color:#7c3aed">✦ Shinely</span>
    </div>
    ${body}
    <hr style="margin:28px 0;border:none;border-top:1px solid #e5e7eb">
    <p style="font-size:12px;color:#9ca3af;margin:0;line-height:1.6">
      You're receiving this because you have an account on Shinely.
      <br>
      <a href="${APP_URL}/privacy" style="color:#7c3aed;text-decoration:none">Privacy Policy</a>
      &nbsp;·&nbsp;
      <a href="${APP_URL}/terms" style="color:#7c3aed;text-decoration:none">Terms of Service</a>
    </p>
  </div>
</body>
</html>`;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  if (!RESEND_API_KEY) {
    console.error("[send-email] RESEND_API_KEY is not set");
    return new Response(
      JSON.stringify({ error: "Email service not configured" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let payload: { to: string; template: string; data: Record<string, unknown> };
  try {
    payload = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const { to, template, data } = payload;
  if (!to || !template || !data) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: to, template, data" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const built = buildEmail(template as TemplateName, data);
  if (!built) {
    return new Response(
      JSON.stringify({ error: `Unknown template: ${template}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const { subject, body } = built;

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      subject,
      html: wrapHtml(subject, body),
    }),
  });

  if (!resendRes.ok) {
    const errText = await resendRes.text();
    console.error(`[send-email] Resend error ${resendRes.status}:`, errText);
    return new Response(
      JSON.stringify({ error: "Failed to send email", details: errText }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const result = await resendRes.json();
  console.log(`[send-email] Sent "${template}" to ${to} — id: ${result.id}`);

  return new Response(
    JSON.stringify({ success: true, id: result.id }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

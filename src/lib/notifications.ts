import { supabase } from "@/integrations/supabase/client";

interface SendNotificationArgs {
  userId: string;
  title: string;
  message: string;
  type: string;
  relatedId?: string | null;
  link?: string | null;
}

/**
 * Sends a notification to another user via the `send_notification` RPC.
 * The RPC validates the caller's relationship to the recipient (admin,
 * shared job, recent review, shared conversation) and inserts the row
 * with SECURITY DEFINER, so the strict RLS on `notifications` doesn't
 * block legitimate cross-user messages.
 *
 * Failures are swallowed (and logged) — notifications are best-effort and
 * should never break the surrounding flow.
 */
export async function sendNotification(args: SendNotificationArgs): Promise<void> {
  try {
    const { error } = await supabase.rpc("send_notification", {
      p_user_id: args.userId,
      p_title: args.title,
      p_message: args.message,
      p_type: args.type,
      p_related_id: args.relatedId ?? null,
      p_link: args.link ?? null,
    });
    if (error) console.error("[sendNotification] rpc error:", error);
  } catch (e) {
    console.error("[sendNotification] threw:", e);
  }
}

export async function sendNotifications(targets: SendNotificationArgs[]): Promise<void> {
  await Promise.all(targets.map(sendNotification));
}

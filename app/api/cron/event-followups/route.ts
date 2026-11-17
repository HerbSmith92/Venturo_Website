import { sendDueEventFollowups } from "@/lib/event-followups";
import { sendDueEventReminders } from "@/lib/event-reminders";
import { processNotificationJobs, scheduleEventReminderJobs } from "@/lib/notification-outbox";
import { platformFeatures } from "@/lib/platform-features";
import { generateDueEventDayReports, recalculateDueEventFinancials } from "@/lib/event-reports";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  }
  const followups = await sendDueEventFollowups();
  const reminders = platformFeatures.notificationOutbox
    ? await scheduleEventReminderJobs()
    : await sendDueEventReminders();
  const deliveries = platformFeatures.notificationOutbox
    ? await processNotificationJobs()
    : { claimed: 0, sent: 0, failed: 0 };
  const eventDayReports = platformFeatures.eventReports
    ? await generateDueEventDayReports()
    : { generated: 0 };
  const financials = platformFeatures.eventReports
    ? await recalculateDueEventFinancials()
    : { recalculated: 0 };
  const analytics = platformFeatures.enhancedAnalytics
    ? await createServiceClient()?.rpc("prune_analytics_diagnostics")
    : null;
  const failed =
    ("error" in followups && followups.error) ||
    ("error" in reminders && reminders.error) ||
    ("error" in deliveries && deliveries.error) ||
    ("error" in eventDayReports && eventDayReports.error) ||
    ("error" in financials && financials.error) ||
    analytics?.error;
  if (failed) {
    return NextResponse.json({ ...followups, reminders, deliveries, eventDayReports, financials, analytics }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...followups, reminders, deliveries, eventDayReports, financials, analytics });
}

export async function POST(request: Request) {
  return GET(request);
}

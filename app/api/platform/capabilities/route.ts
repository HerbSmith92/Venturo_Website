import { NextResponse } from "next/server";
import { platformFeatures } from "@/lib/platform-features";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      contractVersion: "2026-11-17",
      minimumContractVersion: "2026-11-17",
      timezoneDefault: "Africa/Johannesburg",
      features: {
        occurrenceBooking: platformFeatures.occurrenceBooking,
        notificationPreferences: platformFeatures.notificationOutbox,
        communityTools: platformFeatures.communityTools,
        enhancedAnalytics: platformFeatures.enhancedAnalytics,
      },
      bookingMethods: ["free_rsvp", "venturo_ticketing", "external"],
      links: {
        event: "/events/{slug}",
        eventTickets: "/account/tickets",
        community: "/communities/{slug}",
        guide: "/guides/{slug}",
        calendar: "/api/events/{slug}/calendar?on={occurrenceStartsAt}",
      },
      endpoints: {
        interests: "/api/catalog/interests",
        notificationPreferences: "/api/account/notification-preferences",
        analytics: "/api/analytics/screen",
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
}

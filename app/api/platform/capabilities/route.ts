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
      booking: {
        externalDefaultButtonLabel: "Book now",
        externalTrackedPath: "/go/event-booking/{eventId}",
        fields: [
          "booking_method",
          "organiser_display_name",
          "external_provider_name",
          "external_booking_url",
          "external_booking_button_label",
        ],
      },
      links: {
        event: "/events/{slug}",
        eventTickets: "/account/tickets",
        community: "/communities/{slug}",
        guide: "/guides/{slug}",
        calendar: "/api/events/{slug}/calendar?on={occurrenceStartsAt}",
        externalBooking: "/go/event-booking/{eventId}",
      },
      endpoints: {
        interests: "/api/catalog/interests",
        personas: "/api/catalog/personas",
        adventureLevels: "/api/catalog/adventure-levels",
        bucketList: "/api/catalog/bucket-list",
        appHome: "/api/app/home?screen={discover|events|community}",
        eventBooking: "/api/events/{idOrSlug}/booking",
        walletToken: "/api/wallet/token",
        achievements: "/api/wallet/achievements",
        notificationPreferences: "/api/account/notification-preferences",
        analytics: "/api/analytics/screen",
      },
      catalogs: {
        interests: true,
        personas: true,
        adventureLevels: true,
        bucketList: true,
        appHomeConfigured: true,
        walletTokenConfigured: true,
        achievementsConfigured: true,
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
}

import { NextResponse } from "next/server";
import { publicEventBooking } from "@/lib/event-types";
import { getEventById, getEventBySlug } from "@/lib/events";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Shared event booking payload for website + native clients.
 * Accepts event id or slug.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const event = UUID.test(id) ? await getEventById(id) : await getEventBySlug(id);
  if (!event || (event.status !== "approved" && event.status !== "cancelled")) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const past = Boolean(event.endsAt && Date.parse(event.endsAt) < Date.now());
  const booking = publicEventBooking(event);
  const available =
    event.status === "approved" &&
    !past &&
    (booking.bookingMethod !== "external" || Boolean(booking.externalBookingUrl));

  return NextResponse.json(
    {
      id: event.id,
      slug: event.slug,
      status: event.status,
      past,
      available,
      title: event.title,
      ...booking,
      snake: {
        booking_method: booking.bookingMethod,
        organiser_display_name: booking.organiserDisplayName,
        external_provider_name: booking.externalProviderName,
        external_booking_url: booking.externalBookingUrl,
        external_booking_button_label: booking.externalBookingButtonLabel,
        external_booking_tracked_path: booking.externalBookingTrackedPath,
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=30, stale-while-revalidate=120",
      },
    },
  );
}

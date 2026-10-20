import { AccountNav } from "@/components/AccountNav";
import { TicketWallet, type WalletTicket } from "@/components/tickets/TicketWallet";
import { getCurrentUser } from "@/lib/auth";
import { listBuyerTickets } from "@/lib/orders";
import QRCode from "qrcode";
import { ticketQrPayload } from "@/lib/ticket-code";
import { redirect } from "next/navigation";

type EventJoin = {
  slug: string | null;
  title: string | null;
  starts_at: string | null;
  ends_at: string | null;
  timezone: string | null;
  venue_name: string | null;
  address_line1: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string | null;
  banner_url: string | null;
  listing_image_url: string | null;
  story_image_url: string | null;
};

type TypeJoin = { name: string | null };

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function clock(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

function dayLabel(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: timezone,
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
    .format(new Date(iso))
    .toUpperCase();
}

function sameDay(start: string, end: string, timezone: string) {
  return dayLabel(start, timezone) === dayLabel(end, timezone);
}

function directionsFor(event: EventJoin) {
  if (event.latitude != null && event.longitude != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}`;
  }
  const query = [event.venue_name, event.address_line1, event.city].filter(Boolean).join(", ");
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export default async function MyTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/tickets");

  const params = await searchParams;
  const rows = await listBuyerTickets(user.id);
  const tickets: WalletTicket[] = await Promise.all(
    rows.map(async (row) => {
      const event = one(row.events as EventJoin | EventJoin[] | null);
      const type = one(row.event_ticket_types as TypeJoin | TypeJoin[] | null);
      const timezone = event?.timezone || "Africa/Johannesburg";
      const starts = event?.starts_at ?? null;
      const ends = event?.ends_at ?? null;
      const finish = ends || starts;
      const past = finish ? new Date(finish).getTime() < Date.now() : false;
      const qr = await QRCode.toDataURL(ticketQrPayload(row.code), {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 280,
        color: { dark: "#2A2D35", light: "#EBEBF3" },
      });
      const place = [event?.venue_name, event?.city].filter(Boolean).join(", ") || "Venue to follow";
      return {
        id: row.id,
        code: row.code,
        qr,
        typeName: type?.name || "Ticket",
        orderId: row.order_id ?? null,
        past,
        title: event?.title || "Event",
        dateLabel: starts ? dayLabel(starts, timezone) : "Date to follow",
        timeLabel: starts
          ? ends && sameDay(starts, ends, timezone)
            ? `${clock(starts, timezone)}–${clock(ends, timezone)}`
            : clock(starts, timezone)
          : "Time to follow",
        place,
        imageUrl:
          event?.banner_url ||
          event?.listing_image_url ||
          event?.story_image_url ||
          "/brand/images/climbing.jpg",
        slug: event?.slug ?? null,
        directions: event ? directionsFor(event) : null,
        cancelled: event?.status === "cancelled",
      };
    }),
  );

  return (
    <main className="shell">
      <section className="section">
        <AccountNav current="tickets" />
        <TicketWallet tickets={tickets} highlightOrder={params.order} />
      </section>
    </main>
  );
}

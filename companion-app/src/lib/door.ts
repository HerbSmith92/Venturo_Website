import { formatEventWhen } from "@/lib/event-style";
import { supabase } from "@/lib/supabase";
import { normalizeTicketCode } from "@/lib/ticket-code";
import type {
  CompanionEventCard,
  DoorGuest,
  DoorStats,
  ScanResultCode,
  ScanTicketResult,
} from "@/lib/types";

const EVENT_SELECT = `
  id, title, starts_at, ends_at, timezone, venue_name, city, status,
  listing_image_url, banner_url, story_image_url, organiser_id,
  category, audience_gender,
  event_ticket_types (kind, price_cents, member_price_cents, members_only)
`;

function asStats(raw: unknown, eventId: string): DoorStats {
  const row = (raw ?? {}) as Record<string, unknown>;
  const total = Number(row.totalGuests ?? 0);
  const scanned = Number(row.scannedGuests ?? 0);
  return {
    eventId: String(row.eventId ?? eventId),
    totalGuests: total,
    scannedGuests: scanned,
    remainingGuests: Number(row.remainingGuests ?? Math.max(total - scanned, 0)),
  };
}

function mapGuest(row: Record<string, unknown>): DoorGuest {
  return {
    ticketId: String(row.ticket_id),
    code: String(row.code),
    ticketTypeName: String(row.ticket_type_name ?? "Ticket"),
    buyerId: (row.buyer_id as string | null) ?? null,
    guestName: (row.guest_name as string | null) ?? null,
    guestEmail: (row.guest_email as string | null) ?? null,
    guestPhone: (row.guest_phone as string | null) ?? null,
    scannedAt: (row.scanned_at as string | null) ?? null,
    scannedBy: (row.scanned_by as string | null) ?? null,
    purchasedAt: String(row.purchased_at),
    isScanned: Boolean(row.is_scanned),
  };
}

function pricesFromTickets(tickets: Record<string, unknown>[]) {
  const publicPrices = tickets.filter((ticket) => !ticket.members_only).map((ticket) => Number(ticket.price_cents ?? 0));
  const memberPrices = tickets
    .map((ticket) => ticket.member_price_cents)
    .filter((price): price is number => price !== null && price !== undefined)
    .map(Number);
  const paid = tickets.filter((ticket) => ticket.kind !== "free");
  const membersOnly = tickets.length > 0 && paid.length > 0 && paid.every((ticket) => Boolean(ticket.members_only));
  return {
    fromPriceCents: publicPrices.length
      ? Math.min(...publicPrices)
      : membersOnly
        ? null
        : tickets.length
          ? Number(tickets[0]?.price_cents ?? 0)
          : null,
    memberFromPriceCents: memberPrices.length ? Math.min(...memberPrices) : null,
    membersOnly,
  };
}

function mapEvent(row: Record<string, unknown>, stats: DoorStats | null): CompanionEventCard {
  const startsAt = String(row.starts_at ?? "");
  const timezone = String(row.timezone ?? "Africa/Johannesburg");
  const tickets = (row.event_ticket_types as Record<string, unknown>[] | null) ?? [];
  const prices = pricesFromTickets(tickets);
  return {
    id: String(row.id),
    title: String(row.title ?? "Event"),
    startsAt,
    endsAt: String(row.ends_at ?? ""),
    timezone,
    venueName: String(row.venue_name ?? ""),
    city: (row.city as string | null) ?? null,
    status: String(row.status ?? ""),
    category: (row.category as string | null) ?? null,
    audienceGender: String(row.audience_gender || "Everyone"),
    fromPriceCents: prices.fromPriceCents,
    memberFromPriceCents: prices.memberFromPriceCents,
    membersOnly: prices.membersOnly,
    imageUrl:
      (row.listing_image_url as string | null) ||
      (row.banner_url as string | null) ||
      (row.story_image_url as string | null),
    whenLabel: formatEventWhen(startsAt, timezone),
    stats,
  };
}

export async function getDoorStats(eventId: string) {
  const { data, error } = await supabase.rpc("get_event_door_stats", { p_event_id: eventId });
  if (error) throw new Error(error.message);
  return asStats(data, eventId);
}

export async function listDoorGuests(eventId: string) {
  const { data, error } = await supabase.rpc("list_event_door_guests", { p_event_id: eventId });
  if (error) throw new Error(error.message);
  return ((data as Record<string, unknown>[]) ?? []).map(mapGuest);
}

export async function scanTicket(eventId: string, rawCode: string): Promise<ScanTicketResult> {
  const code = normalizeTicketCode(rawCode);
  if (!code) {
    return { ok: false, result: "not_found", message: "Enter or scan a ticket code." };
  }
  const { data, error } = await supabase.rpc("scan_event_ticket", {
    p_event_id: eventId,
    p_code: code,
  });
  if (error) throw new Error(error.message);
  const row = (data ?? {}) as Record<string, unknown>;
  const ticketRaw = row.ticket as Record<string, unknown> | undefined;
  return {
    ok: Boolean(row.ok),
    result: (row.result as ScanResultCode) || "not_found",
    message: String(row.message ?? ""),
    ticket: ticketRaw
      ? {
          id: String(ticketRaw.id),
          code: String(ticketRaw.code),
          ticketTypeName: String(ticketRaw.ticketTypeName ?? "Ticket"),
          guestName: (ticketRaw.guestName as string | null) ?? null,
          guestEmail: (ticketRaw.guestEmail as string | null) ?? null,
          scannedAt: (ticketRaw.scannedAt as string | null) ?? null,
          isScanned: Boolean(ticketRaw.isScanned),
        }
      : undefined,
    stats: row.stats ? asStats(row.stats, eventId) : undefined,
  };
}

export async function listDoorEvents(): Promise<CompanionEventCard[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: own, error: ownError } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .eq("organiser_id", user.id)
    .in("status", ["approved", "cancelled"]);
  if (ownError) throw new Error(ownError.message);

  const { data: collab } = await supabase
    .from("event_collaborators")
    .select("event_id")
    .eq("user_id", user.id);

  const extraIds = [...new Set((collab ?? []).map((row) => row.event_id as string))].filter(
    (id) => !(own ?? []).some((event) => event.id === id),
  );

  let extras: Record<string, unknown>[] = [];
  if (extraIds.length) {
    const { data } = await supabase
      .from("events")
      .select(EVENT_SELECT)
      .in("id", extraIds)
      .in("status", ["approved", "cancelled"]);
    extras = (data as Record<string, unknown>[]) ?? [];
  }

  const rows = [...((own as Record<string, unknown>[]) ?? []), ...extras];
  const cards = await Promise.all(
    rows.map(async (row) => {
      const id = String(row.id);
      let stats: DoorStats | null = null;
      try {
        stats = await getDoorStats(id);
      } catch {
        stats = null;
      }
      return mapEvent(row, stats);
    }),
  );

  return cards.sort((a, b) => {
    if (!a.startsAt && !b.startsAt) return 0;
    if (!a.startsAt) return 1;
    if (!b.startsAt) return -1;
    return new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime();
  });
}

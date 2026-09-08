import { createClient } from "@/lib/supabase/server";
import type { VenturoEvent } from "@/lib/event-types";
import { formatEventWhen, listOrganiserEvents } from "@/lib/events";
import { isStaff, type AppRole } from "@/lib/roles";

export type DoorStats = {
  eventId: string;
  totalGuests: number;
  scannedGuests: number;
  remainingGuests: number;
};

export type DoorGuest = {
  ticketId: string;
  code: string;
  ticketTypeName: string;
  buyerId: string | null;
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  scannedAt: string | null;
  scannedBy: string | null;
  purchasedAt: string;
  isScanned: boolean;
};

export type ScanResultCode =
  | "ok"
  | "already_scanned"
  | "wrong_event"
  | "not_found"
  | "cancelled_event";

export type ScanTicketResult = {
  ok: boolean;
  result: ScanResultCode;
  message: string;
  ticket?: {
    id: string;
    code: string;
    ticketTypeName: string;
    guestName: string | null;
    guestEmail: string | null;
    scannedAt: string | null;
    isScanned: boolean;
  };
  stats?: DoorStats;
};

export type HostEventSummary = VenturoEvent & {
  whenLabel: string;
};

function asDoorStats(raw: unknown, eventId: string): DoorStats {
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

/** Normalise QR payloads / pasted codes to the 12-char ticket code. */
export function normalizeTicketCode(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const url = new URL(trimmed);
      const fromQuery = url.searchParams.get("code") || url.searchParams.get("ticket");
      if (fromQuery) return fromQuery.trim().toUpperCase();
      const parts = url.pathname.split("/").filter(Boolean);
      const last = parts[parts.length - 1];
      if (last) return last.trim().toUpperCase();
    }
  } catch {
    // fall through
  }

  const venturoMatch = trimmed.match(/venturo:\/\/ticket\/([A-Za-z0-9]+)/i);
  if (venturoMatch?.[1]) return venturoMatch[1].toUpperCase();

  const jsonMatch = trimmed.match(/"code"\s*:\s*"([A-Za-z0-9]+)"/i);
  if (jsonMatch?.[1]) return jsonMatch[1].toUpperCase();

  return trimmed.replace(/\s+/g, "").toUpperCase();
}

export async function listHostEvents(userId: string): Promise<HostEventSummary[]> {
  const events = await listOrganiserEvents(userId);
  return events.map((event) => ({
    ...event,
    whenLabel: formatEventWhen(event.startsAt, event.timezone),
  }));
}

export async function assertCanManageEventDoor(
  eventId: string,
  userId: string,
  role: AppRole | null,
) {
  const supabase = await createClient();
  if (!supabase) throw new Error("Supabase is not connected.");

  if (isStaff(role)) {
    const { data } = await supabase
      .from("events")
      .select("id, organiser_id, title, slug, status, starts_at, timezone, venue_name, city")
      .eq("id", eventId)
      .maybeSingle();
    if (!data) throw new Error("Event not found.");
    return data;
  }

  const { data } = await supabase
    .from("events")
    .select("id, organiser_id, title, slug, status, starts_at, timezone, venue_name, city")
    .eq("id", eventId)
    .eq("organiser_id", userId)
    .maybeSingle();

  if (!data) throw new Error("Event not found or you are not the host.");
  return data;
}

export async function getEventDoorStats(eventId: string): Promise<DoorStats> {
  const supabase = await createClient();
  if (!supabase) {
    return {
      eventId,
      totalGuests: 0,
      scannedGuests: 0,
      remainingGuests: 0,
    };
  }

  const { data, error } = await supabase.rpc("get_event_door_stats", {
    p_event_id: eventId,
  });
  if (error) throw new Error(error.message);
  return asDoorStats(data, eventId);
}

export async function listEventDoorGuests(eventId: string): Promise<DoorGuest[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("list_event_door_guests", {
    p_event_id: eventId,
  });
  if (error) throw new Error(error.message);
  return ((data as Record<string, unknown>[]) ?? []).map(mapGuest);
}

export async function scanEventTicket(
  eventId: string,
  rawCode: string,
): Promise<ScanTicketResult> {
  const code = normalizeTicketCode(rawCode);
  if (!code) {
    return {
      ok: false,
      result: "not_found",
      message: "Enter or scan a ticket code.",
    };
  }

  const supabase = await createClient();
  if (!supabase) throw new Error("Supabase is not connected.");

  const { data, error } = await supabase.rpc("scan_event_ticket", {
    p_event_id: eventId,
    p_code: code,
  });

  if (error) throw new Error(error.message);

  const row = (data ?? {}) as Record<string, unknown>;
  const ticketRaw = row.ticket as Record<string, unknown> | undefined;
  const statsRaw = row.stats;

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
    stats: statsRaw ? asDoorStats(statsRaw, eventId) : undefined,
  };
}

/** Payload encoded into buyer QR codes — plain code stays scannable offline. */
export function ticketQrPayload(code: string) {
  return normalizeTicketCode(code);
}

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CompanionEventCard, DoorGuest, DoorStats, ScanTicketResult } from "@/lib/types";

const EVENTS_KEY = "venturo-companion-events";
const doorKey = (eventId: string) => `venturo-companion-door:${eventId}`;
const QUEUE_KEY = "venturo-companion-queue";

export type CachedDoor = {
  eventId: string;
  title: string;
  stats: DoorStats;
  guests: DoorGuest[];
  cachedAt: string;
};

export type QueuedScan = {
  id: string;
  eventId: string;
  code: string;
  queuedAt: string;
};

export async function saveEvents(events: CompanionEventCard[]) {
  await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(events));
}

export async function loadEvents(): Promise<CompanionEventCard[]> {
  const raw = await AsyncStorage.getItem(EVENTS_KEY);
  return raw ? (JSON.parse(raw) as CompanionEventCard[]) : [];
}

export async function saveDoor(door: CachedDoor) {
  await AsyncStorage.setItem(doorKey(door.eventId), JSON.stringify(door));
}

export async function loadDoor(eventId: string): Promise<CachedDoor | null> {
  const raw = await AsyncStorage.getItem(doorKey(eventId));
  return raw ? (JSON.parse(raw) as CachedDoor) : null;
}

export async function queueScan(eventId: string, code: string) {
  const item: QueuedScan = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    eventId,
    code,
    queuedAt: new Date().toISOString(),
  };
  const all = await listQueued();
  all.push(item);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(all));
  return item;
}

export async function listQueued(eventId?: string): Promise<QueuedScan[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  const all = raw ? (JSON.parse(raw) as QueuedScan[]) : [];
  return eventId ? all.filter((item) => item.eventId === eventId) : all;
}

export async function removeQueued(id: string) {
  const all = await listQueued();
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(all.filter((item) => item.id !== id)));
}

export function applyLocalCheckIn(
  guests: DoorGuest[],
  stats: DoorStats,
  result: ScanTicketResult,
): { guests: DoorGuest[]; stats: DoorStats } {
  if (!result.ticket) return { guests, stats };
  const scannedAt = result.ticket.scannedAt || new Date().toISOString();
  let found = false;
  const nextGuests = guests.map((guest) => {
    if (guest.code.toUpperCase() !== result.ticket!.code.toUpperCase()) return guest;
    found = true;
    return { ...guest, isScanned: true, scannedAt };
  });
  if (!found) {
    nextGuests.unshift({
      ticketId: result.ticket.id,
      code: result.ticket.code,
      ticketTypeName: result.ticket.ticketTypeName,
      buyerId: null,
      guestName: result.ticket.guestName,
      guestEmail: result.ticket.guestEmail,
      guestPhone: null,
      scannedAt,
      scannedBy: null,
      purchasedAt: scannedAt,
      isScanned: true,
    });
  }
  const scannedGuests = nextGuests.filter((guest) => guest.isScanned).length;
  const totalGuests = nextGuests.length;
  return {
    guests: nextGuests,
    stats: result.stats ?? {
      eventId: stats.eventId,
      totalGuests,
      scannedGuests,
      remainingGuests: Math.max(totalGuests - scannedGuests, 0),
    },
  };
}

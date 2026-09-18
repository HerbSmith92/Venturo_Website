import { eventFeedImage, formatEventWhen, listAccessibleEvents } from "@/lib/events";
import {
  getEventDoorStats,
  type DoorGuest,
  type DoorStats,
} from "@/lib/host-scanning";
import type { EventStatus } from "@/lib/event-types";

export type CompanionEventCard = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  venueName: string;
  city: string | null;
  status: EventStatus;
  category: string | null;
  audienceGender: string;
  fromPriceCents: number | null;
  memberFromPriceCents: number | null;
  membersOnly: boolean;
  imageUrl: string | null;
  whenLabel: string;
  stats: DoorStats | null;
};

export function canOpenCompanionDoor(status: EventStatus) {
  return status === "approved" || status === "cancelled";
}

export async function listCompanionDoorEvents(userId: string): Promise<CompanionEventCard[]> {
  const events = await listAccessibleEvents(userId);
  const doorEvents = events.filter((event) => canOpenCompanionDoor(event.status));

  const cards = await Promise.all(
    doorEvents.map(async (event) => {
      let stats: DoorStats | null = null;
      try {
        stats = await getEventDoorStats(event.id);
      } catch {
        stats = null;
      }
      return {
        id: event.id,
        title: event.title,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        timezone: event.timezone,
        venueName: event.venueName,
        city: event.city,
        status: event.status,
        category: event.category,
        audienceGender: event.audienceGender,
        fromPriceCents: event.fromPriceCents,
        memberFromPriceCents: event.memberFromPriceCents,
        membersOnly: event.membersOnly,
        imageUrl: eventFeedImage(event),
        whenLabel: formatEventWhen(event.startsAt, event.timezone),
        stats,
      } satisfies CompanionEventCard;
    }),
  );

  return cards;
}

export function statsFromGuests(eventId: string, guests: DoorGuest[]): DoorStats {
  const scannedGuests = guests.filter((guest) => guest.isScanned).length;
  const totalGuests = guests.length;
  return {
    eventId,
    totalGuests,
    scannedGuests,
    remainingGuests: Math.max(totalGuests - scannedGuests, 0),
  };
}

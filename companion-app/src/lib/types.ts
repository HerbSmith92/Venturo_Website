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

export type CompanionEventCard = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  venueName: string;
  city: string | null;
  status: string;
  category: string | null;
  audienceGender: string;
  fromPriceCents: number | null;
  memberFromPriceCents: number | null;
  membersOnly: boolean;
  imageUrl: string | null;
  whenLabel: string;
  stats: DoorStats | null;
};

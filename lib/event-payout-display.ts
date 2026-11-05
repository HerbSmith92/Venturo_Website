import { addDays, formatWhen, JOHANNESBURG_OFFSET_MS } from "@/lib/overview/metrics";

export type EventPayoutRow = {
  id: string;
  status: string;
  payoutStatus: string;
  subtotalCents: number;
  commissionCents: number;
  bookingFeeCents: number;
  totalCents: number;
  hostKeepCents: number;
  paidAt: string | null;
};

export type EventPayoutSummary = {
  found: boolean;
  eventId: string;
  eventTitle: string;
  organiserId: string;
  endsAt: string | null;
  timezone: string;
  ended: boolean;
  dueAt: string | null;
  due: boolean;
  overdue: boolean;
  ticketsBought: number;
  complimentaryCount: number;
  freeCount: number;
  grossCents: number;
  venturoFeesCents: number;
  hostKeepCents: number;
  owedCents: number;
  paidOutCents: number;
  waivedCents: number;
  orders: EventPayoutRow[];
};

export type HostPayoutListRow = EventPayoutSummary & {
  organiserName: string;
  bankHolder: string | null;
  bankLast4: string | null;
};

function weekdayInJohannesburg(date: Date) {
  return new Date(date.getTime() + JOHANNESBURG_OFFSET_MS).getUTCDay();
}

/** Johannesburg weekdays only. Payouts wait this long after `ends_at`, then staff pay by hand. */
export const PAYOUT_WORKING_DAYS = 2;

/** Skip Saturday & Sunday. No public-holiday calendar. */
export function addJohannesburgWorkingDays(fromIso: string, days: number) {
  let cursor = new Date(fromIso);
  if (Number.isNaN(cursor.getTime()) || days <= 0) return cursor;
  let added = 0;
  while (added < days) {
    cursor = addDays(cursor, 1);
    const weekday = weekdayInJohannesburg(cursor);
    if (weekday !== 0 && weekday !== 6) added += 1;
  }
  return cursor;
}

export function payoutDueLabel(
  summary: Pick<EventPayoutSummary, "ended" | "owedCents" | "paidOutCents" | "due" | "dueAt">,
) {
  if (!summary.ended) return "Not yet due";
  if (summary.owedCents <= 0) return summary.paidOutCents > 0 ? "Paid to host" : "Nothing to pay";
  if (summary.due) return "Due now";
  return summary.dueAt
    ? `Due ${formatWhen(summary.dueAt, false)}`
    : `Due ${PAYOUT_WORKING_DAYS} working days after the event`;
}

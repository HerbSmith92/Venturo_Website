import {
  formatCents,
  memberPriceCentsFromDiscount,
  parseRandsToCents,
  type EventTicketType,
  type MemberDiscountKind,
  type PlatformFees,
} from "@/lib/event-types";

export type TicketFeeDraft = {
  kind: "paid" | "free" | "donation";
  priceRands: string;
  discountKind: MemberDiscountKind;
  discountValue: string;
  membersOnly: boolean;
  quantity: string;
  passFeesToBuyer: boolean;
  passCommissionToBuyer: boolean;
};

export function ticketListCents(ticket: TicketFeeDraft) {
  if (ticket.kind === "free") return 0;
  return parseRandsToCents(ticket.priceRands);
}

export function ticketMemberCents(ticket: TicketFeeDraft) {
  if (ticket.kind === "free") return null;
  const list = ticketListCents(ticket);
  if (ticket.discountKind === "none") {
    return ticket.membersOnly ? list : null;
  }
  return memberPriceCentsFromDiscount(list, ticket.discountKind, Number(ticket.discountValue));
}

export function linePlatformFees(
  lineCents: number,
  quantity: number,
  fees: PlatformFees,
) {
  if (lineCents <= 0 || quantity <= 0) {
    return { commission: 0, booking: 0, fees: 0 };
  }
  const commission = Math.round((lineCents * fees.commissionPct) / 100);
  const booking = fees.bookingFeeCents * quantity;
  return { commission, booking, fees: commission + booking };
}

function buyerPays(
  gross: number,
  split: { commission: number; booking: number },
  passBooking: boolean,
  passCommission: boolean,
) {
  return gross + (passBooking ? split.booking : 0) + (passCommission ? split.commission : 0);
}

function hostKeep(
  gross: number,
  split: { commission: number; booking: number },
  passBooking: boolean,
  passCommission: boolean,
) {
  return Math.max(
    0,
    gross - (passBooking ? 0 : split.booking) - (passCommission ? 0 : split.commission),
  );
}

export function ticketSalesPreview(ticket: TicketFeeDraft, fees: PlatformFees) {
  const qty = Math.max(0, Number(ticket.quantity) || 0);
  const list = ticketListCents(ticket);
  const member = ticketMemberCents(ticket);
  const standardGross = qty * list;
  const memberGross = member != null ? qty * member : null;
  const standardFees = linePlatformFees(standardGross, qty, fees);
  const memberFees =
    memberGross != null ? linePlatformFees(memberGross, qty, fees) : { commission: 0, booking: 0, fees: 0 };

  const paid = ticket.kind === "paid" && list > 0;
  const passBooking = paid && ticket.passFeesToBuyer;
  const passCommission = paid && ticket.passCommissionToBuyer;

  const standardBuyer = buyerPays(standardGross, standardFees, passBooking, passCommission);
  const standardKeep = hostKeep(standardGross, standardFees, passBooking, passCommission);
  const memberBuyer =
    memberGross == null ? null : buyerPays(memberGross, memberFees, passBooking, passCommission);
  const memberKeep =
    memberGross == null ? null : hostKeep(memberGross, memberFees, passBooking, passCommission);

  const discountLabel =
    ticket.discountKind === "percent" && ticket.discountValue
      ? `${ticket.discountValue}%`
      : ticket.discountKind === "amount" && ticket.discountValue
        ? formatCents(Math.round(Number(ticket.discountValue) * 100))
        : null;

  const deducted =
    ticket.discountKind === "percent" && member != null
      ? list - member
      : ticket.discountKind === "amount" && ticket.discountValue
        ? Math.round(Number(ticket.discountValue) * 100)
        : 0;

  const revenue = ticket.membersOnly ? (memberKeep ?? standardKeep) : standardKeep;

  return {
    qty,
    list,
    member,
    standardGross,
    memberGross,
    standardFees,
    memberFees,
    pass: passBooking || passCommission,
    standardBuyer,
    standardKeep,
    memberBuyer,
    memberKeep,
    discountLabel,
    deducted,
    revenue,
  };
}

export function checkoutBuyerShare(
  lines: {
    ticket: Pick<EventTicketType, "passFeesToBuyer" | "passCommissionToBuyer">;
    quantity: number;
    unitCents: number;
  }[],
  fees: PlatformFees,
) {
  let subtotal = 0;
  let commission = 0;
  let booking = 0;
  let total = 0;

  for (const line of lines) {
    if (line.quantity <= 0) continue;
    const lineCents = line.unitCents * line.quantity;
    subtotal += lineCents;
    const split = linePlatformFees(lineCents, line.quantity, fees);
    commission += split.commission;
    booking += split.booking;
    total += lineCents;
    if (line.ticket.passFeesToBuyer) total += split.booking;
    if (line.ticket.passCommissionToBuyer) total += split.commission;
  }

  return { subtotal, commission, booking, total };
}

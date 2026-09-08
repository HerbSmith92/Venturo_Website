"use client";

import { useMemo, useState } from "react";
import { PAID_AMOUNT_CENTS, PAID_CADENCE, PAID_PRICE } from "@/lib/brand";
import {
  formatCents,
  remainingTickets,
  unitPriceCents,
  type EventTicketType,
  type PlatformFees,
} from "@/lib/event-types";
import { checkoutBuyerShare } from "@/lib/event-fees";

function initialQuantities(tickets: EventTicketType[]) {
  const first = tickets.find((ticket) => remainingTickets(ticket) > 0);
  return Object.fromEntries(
    tickets.map((ticket) => [ticket.id, ticket.id === first?.id ? 1 : 0]),
  );
}

export function TicketCheckoutForm({
  eventSlug,
  tickets,
  paidMember,
  loggedIn,
  fees,
  promoCode: initialPromo = "",
  inviteToken = "",
}: {
  eventSlug: string;
  tickets: EventTicketType[];
  paidMember: boolean;
  loggedIn: boolean;
  fees: PlatformFees;
  promoCode?: string;
  inviteToken?: string;
}) {
  const [qty, setQty] = useState<Record<string, number>>(() => initialQuantities(tickets));
  const [promoCode, setPromoCode] = useState(initialPromo);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [payfast, setPayfast] = useState<{
    action: string;
    fields: Record<string, string>;
  } | null>(null);

  const hasMembersOnly = tickets.some((ticket) => ticket.membersOnly);
  const needsJoin = !paidMember && hasMembersOnly;
  const joining = useMemo(
    () =>
      !paidMember &&
      tickets.some((ticket) => ticket.membersOnly && (qty[ticket.id] ?? 0) > 0),
    [paidMember, tickets, qty],
  );
  const priceAsMember = paidMember || joining;
  const hasSelection = tickets.some((ticket) => (qty[ticket.id] ?? 0) > 0);

  const ticketTotal = useMemo(() => {
    const lines = tickets
      .map((ticket) => ({
        ticket,
        quantity: qty[ticket.id] ?? 0,
        unitCents: unitPriceCents(ticket, priceAsMember),
      }))
      .filter((line) => line.quantity > 0);
    return checkoutBuyerShare(lines, fees).total;
  }, [qty, tickets, priceAsMember, fees]);

  const firstCharge = ticketTotal + (joining ? PAID_AMOUNT_CENTS : 0);
  const memberDealOnly =
    !paidMember &&
    !needsJoin &&
    tickets.some((ticket) => ticket.memberPriceCents !== null && !ticket.membersOnly);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!loggedIn) {
      const next = inviteToken
        ? `/events/${eventSlug}?invite=${encodeURIComponent(inviteToken)}`
        : `/events/${eventSlug}`;
      window.location.href = `/login?next=${encodeURIComponent(next)}`;
      return;
    }
    if (!hasSelection) {
      setError("Choose at least one ticket.");
      return;
    }
    setError(null);
    setPending(true);

    const lines = Object.entries(qty)
      .filter(([, quantity]) => quantity > 0)
      .map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity }));

    const response = await fetch("/api/events/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventSlug, lines, promoCode, inviteToken }),
    });
    const payload = (await response.json()) as {
      error?: string;
      redirect?: string;
      payfast?: { action: string; fields: Record<string, string> };
    };
    setPending(false);

    if (!response.ok) {
      setError(payload.error ?? "Checkout failed.");
      return;
    }
    if (payload.redirect) {
      window.location.href = payload.redirect;
      return;
    }
    if (payload.payfast) {
      setPayfast(payload.payfast);
      return;
    }
    setError("Unexpected checkout response.");
  }

  if (payfast) {
    return (
      <form action={payfast.action} method="post" className="auth-card">
        <p className="eyebrow">PayFast</p>
        <h2>Continue To Payment</h2>
        <p className="muted">
          You&apos;ll pay {formatCents(firstCharge)} securely via PayFast
          {joining ? ` today. Membership then continues at ${PAID_PRICE} ${PAID_CADENCE}.` : "."}
        </p>
        {Object.entries(payfast.fields).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
        <button className="btn btn-primary" type="submit">
          Pay With PayFast
        </button>
      </form>
    );
  }

  let checkoutLabel = `Checkout · ${formatCents(ticketTotal)}`;
  if (!loggedIn) checkoutLabel = "Log In To Buy";
  else if (pending) checkoutLabel = "Please Wait";
  else if (joining) checkoutLabel = `Join & Checkout · ${formatCents(firstCharge)}`;
  else if (needsJoin) checkoutLabel = "Join & Checkout";
  else if (!hasSelection) checkoutLabel = "Choose Tickets";
  else if (ticketTotal === 0) checkoutLabel = "Get Free Tickets";

  return (
    <form onSubmit={onSubmit}>
      <div className="ticket-picker">
        {tickets.map((ticket) => {
          const left = remainingTickets(ticket);
          const unit = unitPriceCents(ticket, priceAsMember);
          const list = ticket.priceCents;
          return (
            <div className="ticket-row" key={ticket.id}>
              <div>
                <strong>{ticket.name}</strong>
                {ticket.membersOnly && (
                  <p className="eyebrow" style={{ margin: "4px 0 0" }}>
                    Paid members
                  </p>
                )}
                <p className="muted" style={{ margin: "4px 0 0" }}>
                  {unit === 0
                    ? "Free"
                    : ticket.membersOnly
                      ? `Members ${formatCents(ticket.memberPriceCents ?? ticket.priceCents)}`
                      : formatCents(unit)}
                  {priceAsMember &&
                    ticket.memberPriceCents !== null &&
                    ticket.memberPriceCents < list && (
                      <span> · was {formatCents(list)}</span>
                    )}
                  {" · "}
                  {left} left
                </p>
              </div>
              <label className="field" style={{ margin: 0 }}>
                <span className="sr-only">Quantity</span>
                <input
                  type="number"
                  min={0}
                  max={left}
                  value={qty[ticket.id] ?? 0}
                  disabled={left === 0}
                  onChange={(e) =>
                    setQty((prev) => ({
                      ...prev,
                      [ticket.id]: Math.max(0, Number(e.target.value) || 0),
                    }))
                  }
                />
              </label>
            </div>
          );
        })}
      </div>
      {needsJoin && (
        <p className="notice">
          {joining ? (
            <>
              Not a member yet? Join at checkout. Today: {formatCents(ticketTotal)} for the
              ticket plus {PAID_PRICE} {PAID_CADENCE}. Due now {formatCents(firstCharge)}.
              Membership then continues monthly.
            </>
          ) : (
            <>
              This ticket is for Venturo members. Choose a quantity, then join &amp; pay for
              the ticket together—{PAID_PRICE} {PAID_CADENCE} plus your ticket in one payment.
            </>
          )}
        </p>
      )}
      {memberDealOnly && (
        <p className="notice">
          Give yourself the member price —{" "}
          <a href="/join/subscribe">subscribe with PayFast</a>, then come back to checkout.
        </p>
      )}
      {error && <p className="error">{error}</p>}
      <label className="field">
        <span>Promo Code</span>
        <input
          value={promoCode}
          onChange={(change) => setPromoCode(change.target.value)}
          autoComplete="off"
        />
      </label>
      <div className="hero-actions">
        <button
          className="btn btn-primary"
          type="submit"
          disabled={pending || (!loggedIn ? false : !hasSelection)}
        >
          {checkoutLabel}
        </button>
      </div>
    </form>
  );
}

"use client";

import { useMemo, useState } from "react";
import {
  formatCents,
  remainingTickets,
  unitPriceCents,
  type EventTicketType,
} from "@/lib/event-types";

export function TicketCheckoutForm({
  eventSlug,
  tickets,
  paidMember,
  loggedIn,
}: {
  eventSlug: string;
  tickets: EventTicketType[];
  paidMember: boolean;
  loggedIn: boolean;
}) {
  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(tickets.map((t) => [t.id, 0])),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [payfast, setPayfast] = useState<{
    action: string;
    fields: Record<string, string>;
  } | null>(null);

  const total = useMemo(() => {
    return tickets.reduce((sum, ticket) => {
      const n = qty[ticket.id] ?? 0;
      return sum + unitPriceCents(ticket, paidMember) * n;
    }, 0);
  }, [qty, tickets, paidMember]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!loggedIn) {
      window.location.href = `/login?next=/events/${eventSlug}`;
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
      body: JSON.stringify({ eventSlug, lines }),
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
        <p className="muted">You&apos;ll pay {formatCents(total)} securely via PayFast.</p>
        {Object.entries(payfast.fields).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
        <button className="btn btn-primary" type="submit">
          Pay With PayFast
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="ticket-picker">
        {tickets.map((ticket) => {
          const left = remainingTickets(ticket);
          const locked = ticket.membersOnly && !paidMember;
          const unit = unitPriceCents(ticket, paidMember);
          const list = ticket.priceCents;
          return (
            <div className={`ticket-row${locked ? " ticket-row-locked" : ""}`} key={ticket.id}>
              <div>
                <strong>{ticket.name}</strong>
                {ticket.membersOnly && (
                  <p className="eyebrow" style={{ margin: "4px 0 0" }}>
                    Paid members
                  </p>
                )}
                <p className="muted" style={{ margin: "4px 0 0" }}>
                  {locked
                    ? ticket.memberPriceCents !== null
                      ? `Members ${formatCents(ticket.memberPriceCents)}`
                      : "Members only"
                    : unit === 0
                      ? "Free"
                      : formatCents(unit)}
                  {paidMember &&
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
                  disabled={left === 0 || locked}
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
      {!paidMember &&
        tickets.some((t) => t.memberPriceCents !== null || t.membersOnly) && (
        <p className="notice">
          Give yourself the member price — subscribe in the app, then come back
          to checkout.
        </p>
      )}
      {error && <p className="error">{error}</p>}
      <div className="hero-actions">
        <button className="btn btn-primary" type="submit" disabled={pending || total < 0}>
          {pending
            ? "Please Wait"
            : !loggedIn
              ? "Log In To Buy"
              : total === 0
                ? "Get Free Tickets"
                : `Checkout · ${formatCents(total)}`}
        </button>
      </div>
    </form>
  );
}

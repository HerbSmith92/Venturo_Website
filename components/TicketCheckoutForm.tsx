"use client";

import { useMemo, useState } from "react";
import {
  formatCents,
  remainingTickets,
  unitPriceCents,
  type EventTicketType,
  type PlatformFees,
} from "@/lib/event-types";
import { checkoutBuyerShare } from "@/lib/event-fees";

type View = "list" | "account" | "code" | "basket";

function parseBasket(raw?: string) {
  const map: Record<string, number> = {};
  if (!raw) return map;
  for (const part of raw.split(",")) {
    const [id, amount] = part.split(":");
    const quantity = Number(amount);
    if (id && Number.isFinite(quantity)) map[id] = Math.max(0, Math.floor(quantity));
  }
  return map;
}

function startingQuantities(tickets: EventTicketType[], basket?: string) {
  const restored = parseBasket(basket);
  return Object.fromEntries(
    tickets.map((ticket) => {
      const left = remainingTickets(ticket);
      const requested = restored[ticket.id] ?? 0;
      return [ticket.id, Math.min(left, requested)];
    }),
  );
}

export function TicketCheckoutForm({
  eventSlug,
  tickets,
  paidMember,
  loggedIn,
  fees,
  inviteToken = "",
  initialBasket,
}: {
  eventSlug: string;
  tickets: EventTicketType[];
  paidMember: boolean;
  loggedIn: boolean;
  fees: PlatformFees;
  inviteToken?: string;
  initialBasket?: string;
}) {
  const [qty, setQty] = useState<Record<string, number>>(() =>
    startingQuantities(tickets, initialBasket),
  );
  const [view, setView] = useState<View>(() => {
    const restored = startingQuantities(tickets, initialBasket);
    const hasSelection = Object.values(restored).some((amount) => amount > 0);
    return loggedIn && hasSelection ? "basket" : "list";
  });
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const priceAsMember = paidMember;
  const lines = useMemo(
    () =>
      tickets
        .map((ticket) => ({
          ticket,
          quantity: qty[ticket.id] ?? 0,
          unitCents: unitPriceCents(ticket, priceAsMember),
        }))
        .filter((line) => line.quantity > 0),
    [tickets, qty, priceAsMember],
  );
  const basketShare = useMemo(
    () => (lines.length ? checkoutBuyerShare(lines, fees) : null),
    [lines, fees],
  );

  function setTicketQty(ticketId: string, next: number, max: number) {
    setQty((prev) => ({
      ...prev,
      [ticketId]: Math.min(max, Math.max(0, next)),
    }));
  }

  function returnPath() {
    const params = new URLSearchParams();
    const basket = lines.map((line) => `${line.ticket.id}:${line.quantity}`).join(",");
    if (basket) params.set("basket", basket);
    if (inviteToken) params.set("invite", inviteToken);
    const query = params.toString();
    return query ? `/events/${eventSlug}?${query}` : `/events/${eventSlug}`;
  }

  function buy() {
    if (!lines.length) {
      setError("Choose how many.");
      return;
    }
    if (lines.some((line) => line.ticket.membersOnly && !paidMember)) {
      setError("Subscribe on the website to buy a member ticket.");
      return;
    }
    setError(null);
    setAuthMode("signup");
    setView(loggedIn ? "basket" : "account");
  }

  async function sendCode(event: React.FormEvent) {
    event.preventDefault();
    if (!lines.length) return;
    setError(null);
    setPending(true);
    const form = new FormData();
    form.set("email", email.trim().toLowerCase());
    form.set("mode", authMode);
    form.set("next", returnPath());
    if (authMode === "signup") form.set("firstName", firstName.trim());
    const response = await fetch("/auth/otp/send", { method: "POST", body: form });
    const payload = (await response.json()) as { error?: string; email?: string };
    setPending(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not send the code.");
      return;
    }
    if (payload.email) setEmail(payload.email);
    setView("code");
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    form.set("email", email.trim().toLowerCase());
    form.set("firstName", authMode === "signup" ? firstName.trim() : "");
    form.set("next", returnPath());
    const response = await fetch("/auth/otp/verify", { method: "POST", body: form });
    const payload = (await response.json()) as { error?: string; redirect?: string };
    if (!response.ok) {
      setPending(false);
      setError(payload.error ?? "That code did not work.");
      return;
    }
    window.location.href = payload.redirect ?? returnPath();
  }

  async function pay(event: React.FormEvent) {
    event.preventDefault();
    if (!lines.length) {
      setError("Choose how many.");
      return;
    }
    setError(null);
    setPending(true);
    const response = await fetch("/api/events/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventSlug,
        lines: lines.map((line) => ({ ticketTypeId: line.ticket.id, quantity: line.quantity })),
        promoCode,
        inviteToken,
      }),
    });
    const payload = (await response.json()) as {
      error?: string;
      redirect?: string;
      authorizationUrl?: string;
    };
    if (!response.ok) {
      setPending(false);
      setError(payload.error ?? "Checkout failed.");
      return;
    }
    if (payload.redirect) {
      window.location.href = payload.redirect;
      return;
    }
    if (payload.authorizationUrl) {
      window.location.href = payload.authorizationUrl;
      return;
    }
    setPending(false);
    setError("Unexpected checkout response.");
  }

  if (view === "account" && lines.length) {
    return (
      <form className="ticket-account" onSubmit={(event) => void sendCode(event)}>
        <p className="eyebrow">{authMode === "signup" ? "Create A Profile" : "Welcome Back"}</p>
        <h3>{authMode === "signup" ? "Sign Up" : "Log In"}</h3>
        <p className="muted">
          {authMode === "signup"
            ? "Your name & email. We will send a one-time code."
            : "Enter your email & we will send a one-time code."}
        </p>
        {authMode === "signup" ? (
          <label className="field">
            <span>First Name</span>
            <input
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              autoComplete="given-name"
              required
            />
          </label>
        ) : null}
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Please Wait" : "Email Me A Code"}
        </button>
        <div className="ticket-login-callout">
          <p>{authMode === "signup" ? "Already have an account" : "Need an account?"}</p>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => {
              setAuthMode(authMode === "signup" ? "login" : "signup");
              setError(null);
            }}
          >
            {authMode === "signup" ? "Log In" : "Sign Up"}
          </button>
        </div>
        <button className="btn btn-secondary" type="button" onClick={() => setView("list")}>
          Back To Tickets
        </button>
      </form>
    );
  }

  if (view === "code") {
    return (
      <form className="ticket-account" onSubmit={(event) => void verifyCode(event)}>
        <p className="eyebrow">Check Your Email</p>
        <h3>Enter Your Code</h3>
        <p className="muted">
          We emailed a 6-digit code to <strong>{email}</strong>.
        </p>
        <label className="field">
          <span>One-Time Code</span>
          <input
            name="token"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6,8}"
            minLength={6}
            maxLength={8}
            required
            placeholder="123456"
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Please Wait" : "Verify & Continue"}
        </button>
        <p className="muted">
          <button type="button" className="linkish" disabled={pending} onClick={() => setView("account")}>
            Use a different email
          </button>
        </p>
      </form>
    );
  }

  if (view === "basket" && basketShare) {
    const payLabel = pending
      ? "Please Wait"
      : basketShare.total === 0
        ? "Get Free Tickets"
        : `Pay · ${formatCents(basketShare.total)}`;
    return (
      <form className="ticket-basket" onSubmit={(event) => void pay(event)}>
        <p className="eyebrow">Your Basket</p>
        {lines.map((line) => {
          const left = remainingTickets(line.ticket);
          return (
            <div key={line.ticket.id}>
              <h3>{line.ticket.name}</h3>
              {line.ticket.description ? <p className="muted">{line.ticket.description}</p> : null}
              <p className="muted">
                {line.quantity} × {line.unitCents === 0 ? "Free" : formatCents(line.unitCents)}
              </p>
              <div className="ticket-qty" role="group" aria-label={`Quantity for ${line.ticket.name}`}>
                <button
                  type="button"
                  onClick={() => setTicketQty(line.ticket.id, line.quantity - 1, left)}
                  disabled={line.quantity <= 0}
                  aria-label="Fewer"
                >
                  −
                </button>
                <input
                  inputMode="numeric"
                  aria-label="Quantity"
                  value={line.quantity}
                  onChange={(event) =>
                    setTicketQty(
                      line.ticket.id,
                      Number(event.target.value.replace(/[^\d]/g, "")) || 0,
                      left,
                    )
                  }
                />
                <button
                  type="button"
                  onClick={() => setTicketQty(line.ticket.id, line.quantity + 1, left)}
                  disabled={line.quantity >= left}
                  aria-label="More"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
        <p>
          <strong>{formatCents(basketShare.total)}</strong>
        </p>
        <label className="field">
          <span>Promo Code</span>
          <input
            value={promoCode}
            onChange={(event) => setPromoCode(event.target.value)}
            autoComplete="off"
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn btn-primary" type="submit" disabled={pending || !lines.length}>
          {payLabel}
        </button>
        <button className="btn btn-secondary" type="button" onClick={() => setView("list")}>
          Back To Tickets
        </button>
      </form>
    );
  }

  return (
    <div className="ticket-picker">
      {tickets.map((ticket) => {
        const left = remainingTickets(ticket);
        const unit = unitPriceCents(ticket, priceAsMember);
        const list = ticket.priceCents;
        const quantity = qty[ticket.id] ?? 0;
        const memberLocked = ticket.membersOnly && !paidMember;
        return (
          <article className="ticket-offer" key={ticket.id}>
            <h3>{ticket.name}</h3>
            {ticket.description ? <p className="muted">{ticket.description}</p> : null}
            {ticket.membersOnly ? <p className="eyebrow">Paid members</p> : null}
            <p className="muted">
              {unit === 0
                ? "Free"
                : ticket.membersOnly
                  ? `Members ${formatCents(ticket.memberPriceCents ?? ticket.priceCents)}`
                  : formatCents(unit)}
              {priceAsMember &&
              ticket.memberPriceCents !== null &&
              ticket.memberPriceCents < list ? (
                <span> · was {formatCents(list)}</span>
              ) : null}
              {" · "}
              {left} left
            </p>
            {memberLocked ? (
              <p className="notice">
                This ticket is for Venturo members. <a href="/join/subscribe">Subscribe</a>.
              </p>
            ) : null}
            {!memberLocked &&
            !paidMember &&
            ticket.memberPriceCents !== null &&
            !ticket.membersOnly ? (
              <p className="notice">
                Give yourself the member price. <a href="/join/subscribe">Subscribe</a>.
              </p>
            ) : null}
            <div className="ticket-qty" role="group" aria-label={`Quantity for ${ticket.name}`}>
              <button
                type="button"
                onClick={() => setTicketQty(ticket.id, quantity - 1, left)}
                disabled={left < 1 || quantity <= 0 || memberLocked}
                aria-label="Fewer"
              >
                −
              </button>
              <input
                inputMode="numeric"
                aria-label="Quantity"
                value={quantity}
                disabled={left < 1 || memberLocked}
                onChange={(event) =>
                  setTicketQty(ticket.id, Number(event.target.value.replace(/[^\d]/g, "")) || 0, left)
                }
              />
              <button
                type="button"
                onClick={() => setTicketQty(ticket.id, quantity + 1, left)}
                disabled={left < 1 || quantity >= left || memberLocked}
                aria-label="More"
              >
                +
              </button>
            </div>
          </article>
        );
      })}
      {error ? <p className="error">{error}</p> : null}
      <button className="btn btn-primary" type="button" onClick={buy}>
        Buy
      </button>
    </div>
  );
}

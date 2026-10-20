"use client";

import { useMemo, useState } from "react";
import { PassportScene } from "@/components/tickets/PassportScene";

export type WalletTicket = {
  id: string;
  code: string;
  qr: string;
  typeName: string;
  orderId: string | null;
  past: boolean;
  title: string;
  dateLabel: string;
  timeLabel: string;
  place: string;
  imageUrl: string;
  slug: string | null;
  directions: string | null;
  cancelled: boolean;
};

export function TicketWallet({
  tickets,
  highlightOrder,
}: {
  tickets: WalletTicket[];
  highlightOrder?: string;
}) {
  const upcoming = useMemo(
    () => tickets.filter((ticket) => !ticket.past),
    [tickets],
  );
  const past = useMemo(
    () => tickets.filter((ticket) => ticket.past),
    [tickets],
  );
  const highlighted = tickets.find((ticket) => highlightOrder && ticket.orderId === highlightOrder);
  const [tab, setTab] = useState<"upcoming" | "past">(
    highlighted?.past || (upcoming.length === 0 && past.length > 0) ? "past" : "upcoming",
  );
  const list = tab === "past" ? past : upcoming;
  const startAt = Math.max(
    0,
    list.findIndex((ticket) => highlighted && ticket.id === highlighted.id),
  );
  const [index, setIndex] = useState(startAt === -1 ? 0 : startAt);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const safeIndex = list.length === 0 ? 0 : Math.min(index, list.length - 1);
  const ticket = list[safeIndex];

  function choose(next: "upcoming" | "past") {
    setTab(next);
    setIndex(0);
    setDetailsOpen(false);
  }

  function download() {
    document.body.classList.add("printing-passport");
    const previous = document.title;
    document.title = ticket
      ? `Venturo ticket · ${ticket.title}`
      : "Venturo ticket";
    const done = () => {
      document.body.classList.remove("printing-passport");
      document.title = previous;
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    window.print();
  }

  return (
    <div className="ticket-wallet">
      <div className="ticket-wallet-head">
        <div>
          <h1>My tickets</h1>
          <p className="lede muted">Good plans. Great stories.</p>
        </div>
      </div>

      <div className="ticket-wallet-tools">
        <div className="ticket-wallet-tabs" role="tablist" aria-label="Ticket groups">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "upcoming"}
            className={tab === "upcoming" ? "on" : undefined}
            onClick={() => choose("upcoming")}
          >
            Upcoming
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "past"}
            className={tab === "past" ? "on" : undefined}
            onClick={() => choose("past")}
          >
            Past adventures
          </button>
        </div>
        {list.length > 0 ? (
          <div className="ticket-wallet-pager">
            <button
              type="button"
              aria-label="Previous ticket"
              disabled={safeIndex === 0}
              onClick={() => {
                setIndex((current) => Math.max(0, current - 1));
                setDetailsOpen(false);
              }}
            >
              ‹
            </button>
            <span>
              {tab === "past" ? `${safeIndex + 1} of ${list.length}` : `Ticket ${safeIndex + 1} of ${list.length}`}
            </span>
            <button
              type="button"
              aria-label="Next ticket"
              disabled={safeIndex >= list.length - 1}
              onClick={() => {
                setIndex((current) => Math.min(list.length - 1, current + 1));
                setDetailsOpen(false);
              }}
            >
              ›
            </button>
          </div>
        ) : null}
      </div>

      {!ticket ? (
        <p className="ticket-wallet-empty">
          {tab === "past" ? (
            "No past adventures yet. They land here once the day is done."
          ) : (
            <>
              Nothing coming up. <a href="/events">Browse events</a> to grab a spot.
            </>
          )}
        </p>
      ) : (
        <>
          <article className={`passport${ticket.past ? " is-past" : ""}`}>
            <div className="passport-top">
              <PassportScene complete={ticket.past} imageUrl={ticket.imageUrl} />
              <div className="passport-copy">
                <h2 className="passport-title">{ticket.title}</h2>
                <p className="passport-kicker">Your next good story</p>
                <ul className="passport-facts">
                  <li>
                    <CalendarIcon />
                    <span>{ticket.dateLabel}</span>
                  </li>
                  <li>
                    <ClockIcon />
                    <span>{ticket.timeLabel}</span>
                  </li>
                  <li>
                    <PinIcon />
                    <span>{ticket.place}</span>
                  </li>
                </ul>
                {ticket.cancelled ? <p className="passport-cancelled">This event is cancelled.</p> : null}
              </div>
            </div>
            {ticket.past ? null : (
              <div className="passport-stub">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ticket.qr} alt={`QR code for ticket ${ticket.code}`} width={148} height={148} />
                <p className="passport-code">
                  <strong>{ticket.code}</strong>
                  {ticket.cancelled ? (
                    <span className="passport-status bad">Cancelled</span>
                  ) : (
                    <span className="passport-status">
                      <svg viewBox="0 0 16 16" aria-hidden="true">
                        <circle cx="8" cy="8" r="7" fill="currentColor" />
                        <path d="M4.5 8.2 7 10.5 11.5 5.5" fill="none" stroke="#EBEBF3" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                      Confirmed
                    </span>
                  )}
                </p>
              </div>
            )}
          </article>

          <div className="passport-actions">
            <button type="button" className="passport-download" onClick={download}>
              <DownloadIcon />
              {ticket.past ? "Download keepsake" : "Download ticket"}
            </button>
            {ticket.past ? (
              ticket.slug ? (
                <a className="passport-text-link" href={`/events/${ticket.slug}`}>
                  View event
                </a>
              ) : null
            ) : (
              <>
                {ticket.directions ? (
                  <a className="passport-directions" href={ticket.directions} target="_blank" rel="noreferrer">
                    <SendIcon />
                    Get directions
                  </a>
                ) : null}
                <button
                  type="button"
                  className="passport-text-link"
                  aria-expanded={detailsOpen}
                  onClick={() => setDetailsOpen((open) => !open)}
                >
                  Ticket details
                </button>
              </>
            )}
          </div>
          {detailsOpen && !ticket.past ? (
            <div className="passport-details">
              <p>
                <span>Ticket</span>
                {ticket.typeName}
              </p>
              <p>
                <span>Code</span>
                {ticket.code}
              </p>
              {ticket.slug ? (
                <p>
                  <a href={`/events/${ticket.slug}`}>View event</a>
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 3.5v4M16 3.5v4M3.5 10h17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 8v4.5l3 2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="11" r="2" fill="currentColor" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4v11M7 11l5 5 5-5M5 19h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12 20 4l-6 16-2.5-6.5L4 12Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

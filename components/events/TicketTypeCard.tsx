"use client";

import { formatCents } from "@/lib/event-types";
import { ticketSalesPreview, type TicketFeeDraft } from "@/lib/event-fees";
import type { MemberDiscountKind, TicketKind } from "@/lib/event-types";
import type { PlatformFees } from "@/lib/event-types";

function Readout({ value }: { value: string }) {
  return <input readOnly tabIndex={-1} value={value} aria-live="polite" />;
}

export function TicketTypeCard({
  ticket,
  fees,
  onChange,
  onRemove,
}: {
  ticket: TicketFeeDraft & { name: string; kind: TicketKind };
  fees: PlatformFees;
  onChange: (patch: Partial<TicketFeeDraft & { name: string }>) => void;
  onRemove: () => void;
}) {
  const sales = ticketSalesPreview(ticket, fees);
  const paid = ticket.kind !== "free";
  const memberSales = sales.memberGross ?? (ticket.membersOnly ? sales.standardGross : 0);

  return (
    <li className="studio-ticket">
      <div className="studio-ticket-row">
        <label className="field">
          <span>Ticket Name</span>
          <input
            value={ticket.name}
            onChange={(event) => onChange({ name: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Qty Available</span>
          <input
            inputMode="numeric"
            value={ticket.quantity}
            onChange={(event) => onChange({ quantity: event.target.value.replace(/[^\d]/g, "") })}
          />
        </label>
        {paid ? (
          <label className="field">
            <span>Ticket Price</span>
            <div className="money-input">
              <span>R</span>
              <input
                inputMode="decimal"
                value={ticket.priceRands}
                onChange={(event) => onChange({ priceRands: event.target.value })}
              />
            </div>
          </label>
        ) : (
          <label className="field">
            <span>Ticket Price</span>
            <Readout value="Free" />
          </label>
        )}
        <label className="field">
          <span>Potential Sales</span>
          <div className="money-input">
            <span>R</span>
            <Readout value={(sales.standardGross / 100).toFixed(2)} />
          </div>
        </label>
      </div>

      {paid ? (
        <>
          <label className="check">
            <input
              type="checkbox"
              checked={ticket.membersOnly}
              onChange={(event) => onChange({ membersOnly: event.target.checked })}
            />
            Exclusive Venturo Members Ticket
          </label>
          {ticket.membersOnly ? (
            <p className="muted" style={{ margin: "0 0 12px" }}>
              Buyers who aren&apos;t members yet can join &amp; pay for the ticket together.
            </p>
          ) : null}

          <div className="studio-ticket-row studio-ticket-member">
            <label className="field">
              <span>Membership Discount Type</span>
              <select
                value={ticket.discountKind}
                onChange={(event) =>
                  onChange({ discountKind: event.target.value as MemberDiscountKind })
                }
              >
                <option value="none">No Deal</option>
                <option value="percent">Percentage</option>
                <option value="amount">Rand</option>
              </select>
            </label>
            <label className="field">
              <span>Qty Available</span>
              <input
                inputMode="numeric"
                value={ticket.quantity}
                onChange={(event) => onChange({ quantity: event.target.value.replace(/[^\d]/g, "") })}
              />
            </label>
            <label className="field">
              <span>Rand / %</span>
              {ticket.discountKind === "percent" ? (
                <div className="money-input">
                  <input
                    inputMode="decimal"
                    value={ticket.discountValue}
                    onChange={(event) => onChange({ discountValue: event.target.value })}
                    placeholder="15"
                  />
                  <span>%</span>
                </div>
              ) : ticket.discountKind === "amount" ? (
                <div className="money-input">
                  <span>R</span>
                  <input
                    inputMode="decimal"
                    value={ticket.discountValue}
                    onChange={(event) => onChange({ discountValue: event.target.value })}
                    placeholder="10"
                  />
                </div>
              ) : (
                <div className="money-input">
                  <span>R</span>
                  <Readout value="" />
                  <span>%</span>
                </div>
              )}
            </label>
            <label className="field">
              <span>Potential Sales</span>
              <div className="money-input">
                <span>R</span>
                <Readout value={(memberSales / 100).toFixed(2)} />
              </div>
            </label>
          </div>

          <div className="studio-fee-board">
            <div className="studio-fee-grid" role="group" aria-label="Who covers fees">
              <span className="studio-fee-spacer" />
              <span className="studio-fee-head">Host Pays</span>
              <span className="studio-fee-head">Customer Pays</span>

              <span>
                Ticket Fee
                {fees.bookingFeeCents ? ` · ${formatCents(fees.bookingFeeCents)}` : ""}
              </span>
              <label className="studio-fee-check">
                <input
                  type="checkbox"
                  checked={!ticket.passFeesToBuyer}
                  onChange={() => onChange({ passFeesToBuyer: false })}
                  aria-label="Host pays ticket fee"
                />
              </label>
              <label className="studio-fee-check">
                <input
                  type="checkbox"
                  checked={ticket.passFeesToBuyer}
                  onChange={() => onChange({ passFeesToBuyer: true })}
                  aria-label="Customer pays ticket fee"
                />
              </label>

              <span>Commission Fee of {fees.commissionPct}%</span>
              <label className="studio-fee-check">
                <input
                  type="checkbox"
                  checked={!ticket.passCommissionToBuyer}
                  onChange={() => onChange({ passCommissionToBuyer: false })}
                  aria-label="Host pays commission"
                />
              </label>
              <label className="studio-fee-check">
                <input
                  type="checkbox"
                  checked={ticket.passCommissionToBuyer}
                  onChange={() => onChange({ passCommissionToBuyer: true })}
                  aria-label="Customer pays commission"
                />
              </label>
            </div>

            <label className="field studio-ticket-revenue">
              <span>Potential Revenue</span>
              <div className="money-input">
                <span>R</span>
                <Readout value={(sales.revenue / 100).toFixed(2)} />
              </div>
            </label>
          </div>
        </>
      ) : null}

      <button className="btn btn-ghost" type="button" onClick={onRemove}>
        Remove
      </button>
    </li>
  );
}

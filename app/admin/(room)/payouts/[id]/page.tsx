import { markEventPayoutPaid } from "@/app/admin/payout-actions";
import { sendEventFollowUpNow } from "@/app/event-followup-actions";
import { requireStaff } from "@/lib/auth";
import { formatCents } from "@/lib/event-types";
import { loadHostReport } from "@/lib/event-followups";
import { getEventPayoutSummary, payoutDueLabel } from "@/lib/event-payouts";
import { formatCount, formatWhen } from "@/lib/overview/metrics";
import { isAdmin } from "@/lib/roles";
import { createServiceClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";

export default async function HostPayoutDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const staff = await requireStaff();
  const { id } = await params;
  const query = await searchParams;
  const [summary, hostReport] = await Promise.all([getEventPayoutSummary(id), loadHostReport(id)]);
  if (!summary.found) notFound();

  const service = createServiceClient();
  let bankLast4: string | null = null;
  let bankHolder: string | null = null;
  if (service && summary.organiserId) {
    const { data } = await service
      .from("organiser_payout_profiles")
      .select("account_holder, account_number_last4")
      .eq("user_id", summary.organiserId)
      .maybeSingle();
    bankLast4 = data?.account_number_last4 ?? null;
    bankHolder = data?.account_holder ?? null;
  }

  const extras = [
    summary.complimentaryCount ? `${formatCount(summary.complimentaryCount)} complimentary` : null,
    summary.freeCount ? `${formatCount(summary.freeCount)} free RSVP` : null,
  ].filter(Boolean);

  return (
    <section className="cr-paper">
      <p className="eyebrow">Host payouts</p>
      <h1>{summary.eventTitle || "Event"}</h1>
      <p className="muted">
        <a href="/admin/payouts">All host payouts</a>
        {summary.endsAt ? ` · Ended ${formatWhen(summary.endsAt)}` : ""}
      </p>
      {query.error ? <p className="error">{query.error}</p> : null}
      {query.done === "paid" ? <p className="muted">Marked paid to host.</p> : null}
      {query.done === "followup" ? <p className="muted">Follow-up send ran for this event.</p> : null}

      <div className="event-dash-stats portal-stat-grid" style={{ marginTop: 24 }}>
        <article className="portal-stat">
          <p className="eyebrow">Tickets bought</p>
          <strong>{formatCount(summary.ticketsBought)}</strong>
          {extras.length ? <p className="muted">{extras.join(" · ")}</p> : null}
        </article>
        <article className="portal-stat">
          <p className="eyebrow">Pay the host</p>
          <strong>{formatCents(summary.owedCents)}</strong>
        </article>
        <article className="portal-stat">
          <p className="eyebrow">Fees kept by Venturo</p>
          <strong>{formatCents(summary.venturoFeesCents)}</strong>
        </article>
        <article className="portal-stat">
          <p className="eyebrow">Due</p>
          <strong>{summary.overdue ? "Overdue" : payoutDueLabel(summary)}</strong>
        </article>
        <article className="portal-stat">
          <p className="eyebrow">Bank</p>
          <strong>{bankLast4 ? `···· ${bankLast4}` : "Not set"}</strong>
          {bankHolder ? <p className="muted">{bankHolder}</p> : null}
        </article>
        <article className="portal-stat">
          <p className="eyebrow">Paid Out</p>
          <strong>{formatCents(summary.paidOutCents)}</strong>
        </article>
      </div>

      <div className="studio-card" style={{ marginTop: 28 }}>
        <h2>Did it happen?</h2>
        <p className="muted">
          {hostReport
            ? hostReport.happened
              ? `Host said yes. ${hostReport.note}`
              : `Host said no. ${hostReport.note}`
            : "Host has not confirmed yet. Guest reviews land on the same event."}
        </p>
        <form action={sendEventFollowUpNow}>
          <input type="hidden" name="eventId" value={id} />
          <button className="btn btn-secondary" type="submit">
            Send follow-up now
          </button>
        </form>
      </div>

      {isAdmin(staff.role) && summary.owedCents > 0 ? (
        <form action={markEventPayoutPaid} style={{ marginTop: 28 }}>
          <input type="hidden" name="eventId" value={id} />
          <p className="muted">
            Wait 2 working days after the event, send the EFT yourself, then mark paid. This does not
            move money.
          </p>
          <button className="btn btn-primary" type="submit">
            Mark paid to host
          </button>
        </form>
      ) : null}
      {!isAdmin(staff.role) && summary.owedCents > 0 ? (
        <p className="muted" style={{ marginTop: 28 }}>
          Only an admin can mark this paid.
        </p>
      ) : null}
    </section>
  );
}

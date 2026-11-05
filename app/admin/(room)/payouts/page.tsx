import { requireStaff } from "@/lib/auth";
import { formatCents } from "@/lib/event-types";
import { listEndedHostPayouts, payoutDueLabel } from "@/lib/event-payouts";
import { formatCount, formatWhen } from "@/lib/overview/metrics";

export default async function HostPayoutsPage() {
  await requireStaff();
  const rows = await listEndedHostPayouts();

  return (
    <section>
      <p className="eyebrow">Settings</p>
      <h1>Host payouts</h1>
      <p className="lede muted">
        Ended events that still have money owed to the host. Same figures as Event Host Payment. Wait 2
        working days after the event, send the EFT by hand, then mark paid. This list does not move money.
      </p>
      <p className="muted">{rows.length} events owed</p>
      <div className="cr-table-wrap">
        <table className="cr-table">
          <thead>
            <tr>
              <th>Event</th>
              <th>Host</th>
              <th>Ended</th>
              <th>Tickets bought</th>
              <th>Pay the host</th>
              <th>Bank</th>
              <th>Due</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted">
                  No ended events waiting to be paid.
                </td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <tr key={row.eventId}>
                <td>
                  <a href={`/admin/payouts/${row.eventId}`}>{row.eventTitle || "Event"}</a>
                </td>
                <td>{row.organiserName}</td>
                <td>{row.endsAt ? formatWhen(row.endsAt) : "—"}</td>
                <td>{formatCount(row.ticketsBought)}</td>
                <td>{formatCents(row.owedCents)}</td>
                <td>
                  {row.bankLast4 ? `···· ${row.bankLast4}` : "Not set"}
                  {row.bankHolder ? ` · ${row.bankHolder}` : ""}
                </td>
                <td>{row.overdue ? `Overdue · ${payoutDueLabel(row)}` : payoutDueLabel(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

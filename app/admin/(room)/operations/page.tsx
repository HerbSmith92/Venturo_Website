import { formatRand } from "@/lib/control-room-shared";
import { hostOwedCents, inRange, parseJohannesburgDate, addDays } from "@/lib/overview/metrics";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type OrderRow = {
  id: string;
  status: string;
  subtotal_cents: number | null;
  commission_cents: number | null;
  booking_fee_cents: number | null;
  total_cents: number | null;
  payout_status: string | null;
  paid_at: string | null;
  refunded_at?: string | null;
  created_at: string;
  events?: { title?: string } | { title?: string }[] | null;
};

const VIEWS = ["exceptions", "paid", "refunded", "owed"] as const;

export default async function OperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; from?: string; to?: string; order?: string }>;
}) {
  const params = await searchParams;
  const view = VIEWS.includes(params.status as (typeof VIEWS)[number]) ? (params.status as (typeof VIEWS)[number]) : "exceptions";
  const service = createServiceClient() ?? (await createClient());
  const start = parseJohannesburgDate(params.from);
  const endDay = parseJohannesburgDate(params.to);
  const end = endDay ? new Date(addDays(endDay, 1).getTime() - 1) : null;

  let rows: OrderRow[] = [];
  let unavailable = false;
  if (service) {
    let query = service
      .from("event_orders")
      .select("id, status, subtotal_cents, commission_cents, booking_fee_cents, total_cents, payout_status, paid_at, refunded_at, created_at, events ( title )")
      .order("created_at", { ascending: false })
      .limit(200);
    if (view === "paid") query = query.in("status", ["paid", "refunded"]);
    else if (view === "refunded") query = query.eq("status", "refunded");
    else if (view === "owed") query = query.eq("status", "paid").eq("payout_status", "owed");
    else query = query.in("status", ["pending", "failed", "refunded"]);
    const result = await query;
    if (result.error && /refunded_at/i.test(result.error.message)) {
      let legacy = service
        .from("event_orders")
        .select("id, status, subtotal_cents, commission_cents, booking_fee_cents, total_cents, payout_status, paid_at, created_at, events ( title )")
        .order("created_at", { ascending: false })
        .limit(200);
      if (view === "paid") legacy = legacy.in("status", ["paid", "refunded"]);
      else if (view === "refunded") legacy = legacy.eq("status", "refunded");
      else if (view === "owed") legacy = legacy.eq("status", "paid").eq("payout_status", "owed");
      else legacy = legacy.in("status", ["pending", "failed", "refunded"]);
      const second = await legacy;
      if (second.error) unavailable = true;
      else rows = (second.data ?? []) as OrderRow[];
    } else if (result.error) {
      unavailable = true;
    } else {
      rows = ((result.data ?? []) as OrderRow[]).filter((row) => {
        if (!start || !end) return true;
        if (view === "refunded") return inRange(row.refunded_at, start, end);
        if (view === "paid") return inRange(row.paid_at, start, end);
        return inRange(row.created_at, start, end);
      });
      if (params.order) rows = rows.filter((row) => row.id === params.order);
    }
  } else {
    unavailable = true;
  }

  const gross = rows
    .filter((row) => row.status === "paid" || row.status === "refunded")
    .reduce((sum, row) => sum + (row.subtotal_cents ?? 0), 0);
  const owed = rows
    .filter((row) => row.payout_status === "owed" && row.status === "paid")
    .reduce(
      (sum, row) =>
        sum +
        hostOwedCents({
          subtotalCents: row.subtotal_cents ?? 0,
          commissionCents: row.commission_cents ?? 0,
          bookingFeeCents: row.booking_fee_cents ?? 0,
          totalCents: row.total_cents ?? 0,
        }),
      0,
    );

  return (
    <section>
      <p className="eyebrow">Operations</p>
      <h1>Orders</h1>
      <p className="lede muted">
        Same ticket orders as the website and the apps. Gross sales are the buyer subtotal. Host money
        deducts Venturo fees that were not passed on to the buyer. This list shows up to 200 rows.
      </p>
      <p className="muted">
        {rows.length} orders
        {view === "paid" || view === "refunded" ? ` · ${formatRand(gross / 100)} subtotal in view` : ""}
        {view === "owed" ? ` · ${formatRand(owed / 100)} owed to hosts` : ""}
      </p>
      <div className="cr-table-wrap">
        <table className="cr-table">
          <thead>
            <tr>
              <th>Event</th>
              <th>Status</th>
              <th>Payout</th>
              <th>Subtotal</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {unavailable ? (
              <tr>
                <td colSpan={5}>Data unavailable</td>
              </tr>
            ) : null}
            {!unavailable && rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  No orders in this view.
                </td>
              </tr>
            ) : null}
            {rows.map((row) => {
              const event = Array.isArray(row.events) ? row.events[0] : row.events;
              const when = view === "refunded" ? row.refunded_at ?? row.created_at : row.paid_at ?? row.created_at;
              return (
                <tr key={row.id}>
                  <td>{event?.title || "Event"}</td>
                  <td>{row.status}</td>
                  <td>{row.payout_status}</td>
                  <td>{formatRand((row.subtotal_cents ?? 0) / 100)}</td>
                  <td>{new Date(when).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg", hourCycle: "h23" })}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

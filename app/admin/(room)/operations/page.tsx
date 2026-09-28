import { formatRand } from "@/lib/control-room-shared";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type OrderRow = {
  id: string;
  status: string;
  total_cents: number;
  created_at: string;
  events?: { title?: string } | { title?: string }[] | null;
};

export default async function OperationsPage() {
  const service = createServiceClient() ?? (await createClient());
  const { data } = service
    ? await service
        .from("event_orders")
        .select("id, status, total_cents, created_at, events ( title )")
        .in("status", ["pending", "failed", "refunded"])
        .order("created_at", { ascending: false })
        .limit(40)
    : { data: [] };
  const rows = (data ?? []) as OrderRow[];

  return (
    <section>
      <p className="eyebrow">Operations</p>
      <h1>Orders</h1>
      <p className="lede muted">
        Payment exceptions and refunds. These are the same ticket orders the website and the app use.
        Website checkout is PayFast. App memberships land in Members.
      </p>
      <div className="cr-table-wrap">
        <table className="cr-table">
          <thead>
            <tr>
              <th>Event</th>
              <th>Status</th>
              <th>Total</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">
                  No pending, failed, or refunded orders.
                </td>
              </tr>
            ) : null}
            {rows.map((row) => {
              const event = Array.isArray(row.events) ? row.events[0] : row.events;
              return (
                <tr key={row.id}>
                  <td>{event?.title || "Event"}</td>
                  <td>{row.status}</td>
                  <td>{formatRand(row.total_cents / 100)}</td>
                  <td>{new Date(row.created_at).toLocaleString("en-ZA", { hourCycle: "h23" })}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

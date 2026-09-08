import { createClient } from "@/lib/supabase/server";

export type EventPayoutRow = {
  id: string;
  status: string;
  payoutStatus: string;
  subtotalCents: number;
  totalCents: number;
  paidAt: string | null;
};

export type EventPayoutSummary = {
  owedCents: number;
  paidOutCents: number;
  waivedCents: number;
  orders: EventPayoutRow[];
};

export async function getEventPayoutSummary(eventId: string): Promise<EventPayoutSummary> {
  const empty: EventPayoutSummary = {
    owedCents: 0,
    paidOutCents: 0,
    waivedCents: 0,
    orders: [],
  };
  const supabase = await createClient();
  if (!supabase) return empty;

  const { data, error } = await supabase
    .from("event_orders")
    .select("id, status, payout_status, subtotal_cents, total_cents, paid_at")
    .eq("event_id", eventId)
    .eq("status", "paid")
    .order("paid_at", { ascending: false });

  if (error || !data) return empty;

  const orders: EventPayoutRow[] = data.map((row) => ({
    id: row.id,
    status: row.status,
    payoutStatus: row.payout_status,
    subtotalCents: row.subtotal_cents ?? 0,
    totalCents: row.total_cents ?? 0,
    paidAt: row.paid_at,
  }));

  return {
    owedCents: orders
      .filter((row) => row.payoutStatus === "owed")
      .reduce((sum, row) => sum + row.subtotalCents, 0),
    paidOutCents: orders
      .filter((row) => row.payoutStatus === "paid_out")
      .reduce((sum, row) => sum + row.subtotalCents, 0),
    waivedCents: orders
      .filter((row) => row.payoutStatus === "waived")
      .reduce((sum, row) => sum + row.subtotalCents, 0),
    orders,
  };
}

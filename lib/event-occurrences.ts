import { createAnonClient } from "@/lib/supabase/anon";

export type StoredEventOccurrence = {
  id: string;
  eventId: string;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  status: "scheduled" | "rescheduled" | "cancelled" | "ended";
};

export async function listStoredEventOccurrences(eventId: string): Promise<StoredEventOccurrence[]> {
  const supabase = createAnonClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("event_occurrences")
    .select("id, event_id, starts_at, ends_at, timezone, status")
    .eq("event_id", eventId)
    .order("starts_at", { ascending: true });
  if (error) return [];
  return (data ?? []).map((row) => ({
    id: row.id,
    eventId: row.event_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    timezone: row.timezone,
    status: row.status,
  }));
}

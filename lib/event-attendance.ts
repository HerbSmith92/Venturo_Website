import { createServiceClient } from "@/lib/supabase/admin";

export type AttendancePreview = {
  going: number;
  interested: number;
  initials: string[];
  extra: number;
};

/** Ticket holders and people who saved the event stay separate. Names are not published. */
export async function loadAttendancePreview(eventId: string): Promise<AttendancePreview | null> {
  const service = createServiceClient();
  if (!service) return null;

  const [tickets, saves] = await Promise.all([
    service.from("event_tickets").select("buyer_id").eq("event_id", eventId).limit(200),
    service.from("member_saves").select("user_id", { count: "exact", head: true }).eq("kind", "event").eq("target_id", eventId),
  ]);
  if (tickets.error || saves.error) return null;

  const buyers = [...new Set((tickets.data ?? []).map((row) => String(row.buyer_id ?? "")).filter(Boolean))];
  const previewIds = buyers.slice(0, 5);
  const initials: string[] = [];
  if (previewIds.length) {
    const { data } = await service.from("profiles").select("id, display_name").in("id", previewIds);
    const names = new Map((data ?? []).map((row) => [String(row.id), String(row.display_name ?? "")]));
    for (const id of previewIds) {
      const name = names.get(id)?.trim() ?? "";
      initials.push(name ? name.slice(0, 1).toUpperCase() : "V");
    }
  }

  return {
    going: buyers.length,
    interested: saves.count ?? 0,
    initials,
    extra: Math.max(0, buyers.length - initials.length),
  };
}

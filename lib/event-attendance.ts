import { createServiceClient } from "@/lib/supabase/admin";

export type AttendancePreview = {
  going: number;
  interested: number;
  initials: string[];
  extra: number;
};

/** Ticket holders and people interested in this date stay separate. Names are not published. */
export async function loadAttendancePreview(
  eventId: string,
  occurrenceStartsAt?: string | null,
): Promise<AttendancePreview | null> {
  const service = createServiceClient();
  if (!service) return null;

  const { data, error } = await service.rpc("event_attendance_preview", {
    p_event_id: eventId,
    p_occurrence_starts_at: occurrenceStartsAt || null,
  });
  if (error || !data || typeof data !== "object") return null;

  const row = data as {
    going?: number;
    interested?: number;
    initials?: string[];
    extra?: number;
  };
  const initials = Array.isArray(row.initials) ? row.initials.map(String) : [];
  return {
    going: Number(row.going) || 0,
    interested: Number(row.interested) || 0,
    initials,
    extra: Number(row.extra) || 0,
  };
}

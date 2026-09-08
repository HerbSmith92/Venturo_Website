import { createClient } from "@/lib/supabase/server";

export type EventCollaborator = {
  id: string;
  userId: string | null;
  email: string;
  access: "editor" | "door";
  createdAt: string;
};

export async function listEventCollaborators(eventId: string): Promise<EventCollaborator[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("event_collaborators")
      .select("id, user_id, email, access, created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });
    if (error || !data) return [];
    return data.map((row) => ({
      id: row.id,
      userId: row.user_id,
      email: row.email,
      access: row.access === "door" ? "door" : "editor",
      createdAt: row.created_at,
    }));
  } catch {
    return [];
  }
}

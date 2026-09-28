import { createClient } from "@/lib/supabase/server";

export type SaveKind = "listing" | "event" | "guide";

export async function listSaves(userId: string, kind?: SaveKind) {
  const supabase = await createClient();
  if (!supabase) return [];
  let query = supabase
    .from("member_saves")
    .select("kind, target_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (kind) query = query.eq("kind", kind);
  const { data, error } = await query;
  if (error || !data) return [];
  return data as { kind: SaveKind; target_id: string; created_at: string }[];
}

export async function isSaved(userId: string, kind: SaveKind, targetId: string) {
  const supabase = await createClient();
  if (!supabase) return false;
  const { data } = await supabase
    .from("member_saves")
    .select("target_id")
    .eq("user_id", userId)
    .eq("kind", kind)
    .eq("target_id", targetId)
    .maybeSingle();
  return Boolean(data);
}

import { requireGuideWriter } from "@/lib/auth";
import type { AppRole } from "@/lib/roles";
import { isStaff } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export type GuideOwnerFields = {
  created_by?: string | null;
  author_id?: string | null;
};

export type GuideViewer = {
  id: string;
  staff: boolean;
  authorId: string | null;
};

export function guideViewerFor(
  session: { id: string; role: AppRole | null; linkedAuthorId?: string | null } | null,
): GuideViewer {
  return {
    id: session?.id ?? "",
    staff: isStaff(session?.role),
    authorId: session?.linkedAuthorId ?? null,
  };
}

export function canManageGuide(row: GuideOwnerFields, viewer?: GuideViewer) {
  if (!viewer || viewer.staff) return true;
  if (viewer.authorId && row.author_id === viewer.authorId) return true;
  return Boolean(viewer.id) && row.created_by === viewer.id;
}

export async function requireWritableGuide(
  table: "curated_guides" | "curated_event_guides",
  guideId: string,
) {
  const session = await requireGuideWriter();
  if (isStaff(session.role)) return { ok: true as const, session };
  const supabase = await createClient();
  if (!supabase || !guideId) {
    return { ok: false as const, session, error: "You can only edit your own guides." };
  }
  const { data } = await supabase.from(table).select("created_by, author_id").eq("id", guideId).maybeSingle();
  if (!data || !canManageGuide(data, guideViewerFor(session))) {
    return { ok: false as const, session, error: "You can only edit your own guides." };
  }
  return { ok: true as const, session };
}

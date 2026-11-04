import { getCurrentUser } from "@/lib/auth";
import type { GuideKind } from "@/lib/guide-engagement";
import { createClient } from "@/lib/supabase/server";

export async function hasLikedGuide(kind: GuideKind, guideId: string) {
  const user = await getCurrentUser();
  if (!user) return false;
  const supabase = await createClient();
  if (!supabase) return false;
  const { data } = await supabase
    .from("guide_likes")
    .select("guide_id")
    .eq("user_id", user.id)
    .eq("guide_kind", kind)
    .eq("guide_id", guideId)
    .maybeSingle();
  return Boolean(data);
}

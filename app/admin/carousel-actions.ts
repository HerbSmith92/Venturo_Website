"use server";

import { requireGuideWriter } from "@/lib/auth";
import type { CarouselDraft } from "@/lib/guide-carousel";
import { createClient } from "@/lib/supabase/server";

export async function saveGuideCarousel(guideId: string, draft: CarouselDraft) {
  await requireGuideWriter();
  const supabase = await createClient();
  if (!supabase || !guideId) return { ok: false as const, error: "Could not save that carousel." };
  const { error } = await supabase.rpc("admin_save_guide_carousel", {
    p_guide_id: guideId,
    p_draft: draft,
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

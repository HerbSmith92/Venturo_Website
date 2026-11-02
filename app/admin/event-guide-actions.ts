"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireGuideWriter } from "@/lib/auth";
import { fromZaLocalInput, isGuideAction } from "@/lib/guide-shared";
import { createClient } from "@/lib/supabase/server";

function revalidateEventGuides(id?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/event-guides");
  revalidatePath("/admin/guides");
  if (id) revalidatePath(`/admin/event-guides/${id}`);
  revalidatePath("/");
  revalidatePath("/events");
  revalidatePath("/guides");
  revalidatePath("/event-guides");
}

export async function createCuratedEventGuide() {
  await requireGuideWriter();
  const supabase = await createClient();
  if (!supabase) {
    redirect("/admin/guides?error=Could+not+create+that+guide.");
  }

  const { data, error } = await supabase.rpc("admin_create_curated_event_guide");
  const row = (Array.isArray(data) ? data[0] : data) as { id?: string } | null;
  if (error || !row?.id) {
    redirect(
      `/admin/guides?error=${encodeURIComponent(error?.message ?? "Could not create that guide.")}`,
    );
  }

  revalidateEventGuides();
  redirect(`/admin/event-guides/${row.id}`);
}

export async function saveCuratedEventGuide(
  guideId: string,
  draft: {
    title: string;
    intro: string;
    body: string;
    shape: string;
    author_id: string;
    publish_at: string;
    expire_at: string;
    max_price_cents: number | null;
    place_id: string;
    interest_labels: string[];
    persona_labels: string[];
    energy_ranks: number[];
    items: { event_id: string; editorial_note: string }[];
  },
) {
  await requireGuideWriter();
  const supabase = await createClient();
  if (!supabase || !guideId) {
    return { ok: false as const, error: "Could not save that guide." };
  }
  if (!draft.title.trim()) {
    return { ok: false as const, error: "Guide title is required." };
  }

  const { error } = await supabase.rpc("admin_save_curated_event_guide", {
    p_guide_id: guideId,
    p_payload: {
      title: draft.title,
      intro: draft.intro,
      body: draft.body,
      shape: draft.shape,
      author_id: draft.author_id || null,
      publish_at: fromZaLocalInput(draft.publish_at),
      expire_at: fromZaLocalInput(draft.expire_at),
      max_price_cents: draft.max_price_cents,
      place_id: draft.place_id || null,
      interest_labels: draft.interest_labels,
      persona_labels: draft.persona_labels,
      energy_ranks: draft.energy_ranks,
      items: draft.items.map((item, index) => ({
        event_id: item.event_id,
        editorial_note: item.editorial_note,
        sort_order: index,
      })),
    },
  });

  if (error) {
    return { ok: false as const, error: error.message };
  }

  revalidateEventGuides(guideId);
  return { ok: true as const };
}

export async function applyEventGuideAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const action = String(formData.get("action") ?? "");

  if (!supabase || !id || !isGuideAction(action)) {
    redirect("/admin/guides?error=That+action+could+not+run.");
  }

  const { error } = await supabase.rpc("admin_apply_event_guide_action", {
    p_guide_id: id,
    p_action: action,
  });

  if (error) {
    redirect(`/admin/event-guides/${id}?error=${encodeURIComponent(error.message)}`);
  }

  revalidateEventGuides(id);
  redirect(`/admin/event-guides/${id}?done=${action}`);
}

export async function duplicateCuratedEventGuide(formData: FormData) {
  await requireGuideWriter();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!supabase || !id) {
    redirect("/admin/guides?error=Could+not+duplicate+that+guide.");
  }

  const { data, error } = await supabase.rpc("admin_duplicate_curated_event_guide", {
    p_guide_id: id,
  });
  const row = (Array.isArray(data) ? data[0] : data) as { id?: string } | null;

  if (error || !row?.id) {
    redirect(
      `/admin/event-guides/${id}?error=${encodeURIComponent(error?.message ?? "Could not duplicate that guide.")}`,
    );
  }

  revalidateEventGuides(row.id);
  redirect(`/admin/event-guides/${row.id}?done=duplicated`);
}

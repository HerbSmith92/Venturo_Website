"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { fromZaLocalInput, isGuideAction } from "@/lib/guide-shared";
import { createClient } from "@/lib/supabase/server";

function revalidateGuides(id?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/guides");
  if (id) revalidatePath(`/admin/guides/${id}`);
  revalidatePath("/");
  revalidatePath("/guides");
}

export async function createCuratedGuide() {
  await requireAdmin();
  const supabase = await createClient();
  if (!supabase) {
    redirect("/admin/guides?error=Could+not+create+that+guide.");
  }

  const { data, error } = await supabase.rpc("admin_create_curated_guide");
  const row = (Array.isArray(data) ? data[0] : data) as { id?: string } | null;
  if (error || !row?.id) {
    redirect(`/admin/guides?error=${encodeURIComponent(error?.message ?? "Could not create that guide.")}`);
  }

  revalidateGuides();
  redirect(`/admin/guides/${row.id}`);
}

export async function saveCuratedGuide(
  guideId: string,
  draft: {
    title: string;
    intro: string;
    publish_at: string;
    expire_at: string;
    interest_ids: string[];
    items: { listing_id: string; editorial_note: string }[];
  },
) {
  await requireAdmin();
  const supabase = await createClient();
  if (!supabase || !guideId) {
    return { ok: false as const, error: "Could not save that guide." };
  }
  if (!draft.title.trim()) {
    return { ok: false as const, error: "Guide title is required." };
  }

  const { error } = await supabase.rpc("admin_save_curated_guide", {
    p_guide_id: guideId,
    p_payload: {
      title: draft.title,
      intro: draft.intro,
      publish_at: fromZaLocalInput(draft.publish_at),
      expire_at: fromZaLocalInput(draft.expire_at),
      interest_ids: draft.interest_ids,
      items: draft.items.map((item, index) => ({
        listing_id: item.listing_id,
        editorial_note: item.editorial_note,
        sort_order: index,
        item_kind: "listing",
      })),
    },
  });

  if (error) {
    return { ok: false as const, error: error.message };
  }

  revalidateGuides(guideId);
  return { ok: true as const };
}

export async function applyGuideAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const action = String(formData.get("action") ?? "");

  if (!supabase || !id || !isGuideAction(action)) {
    redirect("/admin/guides?error=That+action+could+not+run.");
  }

  const { error } = await supabase.rpc("admin_apply_guide_action", {
    p_guide_id: id,
    p_action: action,
  });

  if (error) {
    redirect(`/admin/guides/${id}?error=${encodeURIComponent(error.message)}`);
  }

  revalidateGuides(id);
  redirect(`/admin/guides/${id}?done=${action}`);
}

export async function duplicateCuratedGuide(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!supabase || !id) {
    redirect("/admin/guides?error=Could+not+duplicate+that+guide.");
  }

  const { data, error } = await supabase.rpc("admin_duplicate_curated_guide", {
    p_guide_id: id,
  });
  const row = (Array.isArray(data) ? data[0] : data) as { id?: string } | null;

  if (error || !row?.id) {
    redirect(
      `/admin/guides/${id}?error=${encodeURIComponent(error?.message ?? "Could not duplicate that guide.")}`,
    );
  }

  revalidateGuides(row.id);
  redirect(`/admin/guides/${row.id}?done=duplicated`);
}

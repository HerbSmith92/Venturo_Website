"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const COMMUNITY_STATUSES = ["draft", "requested", "published", "archived", "suspended"] as const;

function communityStatus(value: string) {
  return COMMUNITY_STATUSES.includes(value as (typeof COMMUNITY_STATUSES)[number]) ? value : "draft";
}

export async function createCommunity() {
  const staff = await requireStaff();
  const supabase = await createClient();
  if (!supabase) redirect("/admin/communities?error=Could+not+create+that+community.");

  const slug = `new-community-${crypto.randomUUID().slice(0, 8)}`;
  const { data, error } = await supabase
    .from("communities")
    .insert({
      title: "",
      slug,
      status: "requested",
      created_by: staff.id,
      updated_by: staff.id,
    })
    .select("id")
    .single();
  if (error || !data?.id) {
    redirect(`/admin/communities?error=${encodeURIComponent(error?.message ?? "Could not create that community.")}`);
  }
  revalidatePath("/admin/communities");
  redirect(`/admin/communities/${data.id}`);
}

export type CommunityDraftInput = {
  title: string;
  about: string;
  areas: string[];
  contactEmail: string;
  phone: string;
  websiteUrl: string;
  instagramUrl: string;
  facebookUrl: string;
  tiktokUrl: string;
  founderName: string;
  founderEmail: string;
  kindIds: string[];
  interestKeywords: string;
  personaIds: string[];
  scaleId: string;
  status: string;
  isFeatured: boolean;
};

export async function saveCommunityDraft(id: string, draft: CommunityDraftInput) {
  const staff = await requireStaff();
  const supabase = await createClient();
  const title = draft.title.trim();
  if (!supabase || !id) return { ok: false as const, error: "Could not save that community." };
  if (!title) return { ok: false as const, error: "A name is required." };

  const { data: existing, error: loadError } = await supabase
    .from("communities")
    .select("slug, social_url")
    .eq("id", id)
    .maybeSingle();
  if (loadError || !existing) return { ok: false as const, error: "Could not find that community." };

  const areas = draft.areas.map((area) => area.trim()).filter(Boolean);
  const kindIds = [...new Set(draft.kindIds.filter(Boolean))];
  let interest: string | null = null;
  if (kindIds.length) {
    const { data: kinds } = await supabase.from("activity_kinds").select("id, title").in("id", kindIds);
    const first = kindIds
      .map((kindId) => (kinds ?? []).find((kind) => kind.id === kindId)?.title)
      .find((value): value is string => Boolean(value));
    interest = first ?? null;
  }

  let slug = existing.slug as string;
  if (slug.startsWith("new-community-")) {
    const next = slugify(title);
    if (next) slug = next;
  }

  const row = {
    title,
    slug,
    about: draft.about.trim() || null,
    interest,
    place_label: areas.length ? areas.join(" · ") : null,
    areas,
    contact_email: draft.contactEmail.trim() || null,
    phone: draft.phone.trim() || null,
    website_url: draft.websiteUrl.trim() || null,
    instagram_url: draft.instagramUrl.trim() || null,
    facebook_url: draft.facebookUrl.trim() || null,
    tiktok_url: draft.tiktokUrl.trim() || null,
    founder_name: draft.founderName.trim() || null,
    founder_email: draft.founderEmail.trim() || null,
    interest_keywords: draft.interestKeywords.trim() || null,
    scale_id: draft.scaleId || null,
    status: communityStatus(draft.status),
    is_featured: draft.isFeatured,
    social_url: (existing.social_url as string | null) ?? null,
    updated_by: staff.id,
  };

  let saved = await supabase.from("communities").update(row).eq("id", id);
  if (saved.error && /duplicate|unique/i.test(saved.error.message)) {
    slug = `${slugify(title)}-${id.slice(0, 8)}`;
    saved = await supabase.from("communities").update({ ...row, slug }).eq("id", id);
  }
  if (saved.error) return { ok: false as const, error: saved.error.message };

  await supabase.from("community_activity_kinds").delete().eq("community_id", id);
  if (kindIds.length) {
    const { error } = await supabase
      .from("community_activity_kinds")
      .insert(kindIds.map((activityKindId) => ({ community_id: id, activity_kind_id: activityKindId })));
    if (error) return { ok: false as const, error: error.message };
  }

  await supabase.from("community_personas").delete().eq("community_id", id);
  const personaIds = [...new Set(draft.personaIds.filter(Boolean))];
  if (personaIds.length) {
    const { error } = await supabase
      .from("community_personas")
      .insert(personaIds.map((personaId) => ({ community_id: id, persona_id: personaId })));
    if (error) return { ok: false as const, error: error.message };
  }

  revalidatePath("/communities");
  revalidatePath(`/communities/${slug}`);
  revalidatePath("/admin/communities");
  revalidatePath("/");
  redirect(`/admin/communities/${id}?done=1`);
}

export async function approveCommunityEvent(communityId: string, eventId: string) {
  await requireStaff();
  const supabase = await createClient();
  if (!supabase || !communityId || !eventId) {
    return { ok: false as const, error: "Could not approve that event." };
  }
  const { error } = await supabase
    .from("community_events")
    .update({ link_status: "approved" })
    .eq("community_id", communityId)
    .eq("event_id", eventId);
  if (error) return { ok: false as const, error: error.message };
  const { data: community } = await supabase.from("communities").select("slug").eq("id", communityId).maybeSingle();
  revalidatePath("/admin/communities");
  revalidatePath(`/admin/communities/${communityId}`);
  if (community?.slug) revalidatePath(`/communities/${community.slug}`);
  revalidatePath("/communities");
  return { ok: true as const };
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export async function saveCommunity(formData: FormData) {
  const staff = await requireStaff();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? "") || title);
  if (!supabase || !title || !slug) {
    redirect("/admin/communities?error=A+title+is+required.");
  }

  const row = {
    title,
    slug,
    about: String(formData.get("about") ?? "").trim() || null,
    cover_url: String(formData.get("cover_url") ?? "").trim() || null,
    interest: String(formData.get("interest") ?? "").trim() || null,
    place_label: String(formData.get("place_label") ?? "").trim() || null,
    social_url: String(formData.get("social_url") ?? "").trim() || null,
    contact_email: String(formData.get("contact_email") ?? "").trim() || null,
    website_url: String(formData.get("website_url") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    instagram_url: String(formData.get("instagram_url") ?? "").trim() || null,
    facebook_url: String(formData.get("facebook_url") ?? "").trim() || null,
    founder_name: String(formData.get("founder_name") ?? "").trim() || null,
    founder_email: String(formData.get("founder_email") ?? "").trim() || null,
    status: communityStatus(String(formData.get("status") ?? "draft")),
    is_featured: formData.get("is_featured") === "on",
    updated_by: staff.id,
  };

  if (id) {
    const { error } = await supabase.from("communities").update(row).eq("id", id);
    if (error) redirect(`/admin/communities/${id}?error=${encodeURIComponent(error.message)}`);
    const eventIds = formData.getAll("event_id").map(String).filter(Boolean);
    await supabase.from("community_events").delete().eq("community_id", id);
    if (eventIds.length) {
      await supabase.from("community_events").insert(
        eventIds.map((eventId) => ({ community_id: id, event_id: eventId })),
      );
    }
    revalidatePath("/communities");
    revalidatePath(`/communities/${slug}`);
    revalidatePath("/");
    redirect(`/admin/communities/${id}?done=1`);
  }

  const { data, error } = await supabase
    .from("communities")
    .insert({ ...row, created_by: staff.id })
    .select("id")
    .single();
  if (error || !data?.id) {
    redirect(`/admin/communities?error=${encodeURIComponent(error?.message ?? "Could not save.")}`);
  }
  revalidatePath("/communities");
  redirect(`/admin/communities/${data.id}?done=1`);
}

export async function saveWebsite(formData: FormData) {
  const staff = await requireStaff();
  const supabase = await createClient();
  if (!supabase) redirect("/admin/website?error=Could+not+save.");

  const { error } = await supabase.from("website_settings").upsert({
    id: 1,
    hero_eyebrow: String(formData.get("hero_eyebrow") ?? "").trim() || null,
    hero_title: String(formData.get("hero_title") ?? "").trim() || null,
    hero_lede: String(formData.get("hero_lede") ?? "").trim() || null,
    hero_image_url: String(formData.get("hero_image_url") ?? "").trim() || null,
    about_title: String(formData.get("about_title") ?? "").trim() || null,
    about_body: String(formData.get("about_body") ?? "").trim() || null,
    help_title: String(formData.get("help_title") ?? "").trim() || null,
    help_body: String(formData.get("help_body") ?? "").trim() || null,
    help_email: String(formData.get("help_email") ?? "").trim() || null,
    app_store_url: String(formData.get("app_store_url") ?? "").trim() || null,
    play_store_url: String(formData.get("play_store_url") ?? "").trim() || null,
    updated_at: new Date().toISOString(),
    updated_by: staff.id,
  });
  if (error) redirect(`/admin/website?error=${encodeURIComponent(error.message)}`);

  const slots = ["event", "listing", "community", "guide"] as const;
  await supabase.from("website_features").delete().in("slot", [...slots]);
  const rows: { slot: string; target_id: string; sort_order: number }[] = [];
  for (const slot of slots) {
    const fromBoxes = formData.getAll(`${slot}_id`).map(String).filter(Boolean);
    const fromText = String(formData.get(`${slot}_ids`) ?? "")
      .split(/[\s,]+/)
      .map((id) => id.trim())
      .filter(Boolean);
    const ids = fromBoxes.length ? fromBoxes : fromText;
    ids.forEach((targetId, index) => {
      rows.push({ slot, target_id: targetId, sort_order: index });
    });
  }
  if (rows.length) {
    const { error: featureError } = await supabase.from("website_features").insert(rows);
    if (featureError) redirect(`/admin/website?error=${encodeURIComponent(featureError.message)}`);
  }

  revalidatePath("/");
  revalidatePath("/about");
  revalidatePath("/help");
  redirect("/admin/website?done=1");
}

export async function saveGuideEvents(formData: FormData) {
  await requireStaff();
  const supabase = await createClient();
  const guideId = String(formData.get("guide_id") ?? "");
  if (!supabase || !guideId) redirect("/admin/guides");
  const eventIds = formData
    .getAll("event_ids")
    .map(String)
    .map((id) => id.trim())
    .filter(Boolean);
  await supabase.from("curated_guide_events").delete().eq("guide_id", guideId);
  if (eventIds.length) {
    const { error } = await supabase.from("curated_guide_events").insert(
      eventIds.map((eventId, index) => ({
        guide_id: guideId,
        event_id: eventId,
        sort_order: index,
      })),
    );
    if (error) redirect(`/admin/guides/${guideId}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/guides");
  redirect(`/admin/guides/${guideId}?done=links`);
}

export async function reviewClaim(formData: FormData) {
  await requireStaff();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!supabase || !id || (status !== "approved" && status !== "rejected")) {
    redirect("/admin/claims?error=That+claim+could+not+be+updated.");
  }
  const { error } = await supabase
    .from("listing_claims")
    .update({
      status,
      review_note: note || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) redirect(`/admin/claims?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/claims");
  redirect("/admin/claims?done=1");
}

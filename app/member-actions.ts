"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import type { SaveKind } from "@/lib/saves";
import { createClient } from "@/lib/supabase/server";

async function requireMember(next: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function toggleSave(formData: FormData) {
  const next = String(formData.get("next") ?? "/account/saved");
  const user = await requireMember(next);
  const kind = String(formData.get("kind") ?? "") as SaveKind;
  const targetId = String(formData.get("target_id") ?? "");
  if (!["listing", "event", "guide"].includes(kind) || !targetId) redirect(next);
  const supabase = await createClient();
  if (!supabase) redirect(next);

  const { data } = await supabase
    .from("member_saves")
    .select("target_id")
    .eq("user_id", user.id)
    .eq("kind", kind)
    .eq("target_id", targetId)
    .maybeSingle();

  if (data) {
    await supabase
      .from("member_saves")
      .delete()
      .eq("user_id", user.id)
      .eq("kind", kind)
      .eq("target_id", targetId);
  } else {
    await supabase.from("member_saves").insert({
      user_id: user.id,
      kind,
      target_id: targetId,
    });
  }
  revalidatePath(next);
  revalidatePath("/account/saved");
  redirect(next);
}

export async function toggleFollow(formData: FormData) {
  const next = String(formData.get("next") ?? "/communities");
  const user = await requireMember(next);
  const communityId = String(formData.get("community_id") ?? "");
  if (!communityId) redirect(next);
  const supabase = await createClient();
  if (!supabase) redirect(next);
  const { data } = await supabase
    .from("community_follows")
    .select("community_id")
    .eq("user_id", user.id)
    .eq("community_id", communityId)
    .maybeSingle();
  if (data) {
    await supabase
      .from("community_follows")
      .delete()
      .eq("user_id", user.id)
      .eq("community_id", communityId);
  } else {
    await supabase.from("community_follows").insert({
      user_id: user.id,
      community_id: communityId,
    });
  }
  revalidatePath("/communities");
  revalidatePath("/account/communities");
  redirect(next);
}

export async function saveReview(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const next = `/directory/${slug}`;
  const user = await requireMember(next);
  const listingId = String(formData.get("listing_id") ?? "");
  const rating = Number(formData.get("rating"));
  const body = String(formData.get("body") ?? "").trim();
  if (!listingId || !Number.isInteger(rating) || rating < 1 || rating > 5 || !body) {
    redirect(`${next}?error=Add+a+rating+and+a+short+note.`);
  }
  const supabase = await createClient();
  if (!supabase) redirect(next);
  const { error } = await supabase.from("listing_reviews").upsert(
    {
      listing_id: listingId,
      user_id: user.id,
      author_name: user.firstName || "Member",
      rating,
      body,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "listing_id,user_id" },
  );
  if (error) redirect(`${next}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(next);
  revalidatePath("/account/reviews");
  redirect(next);
}

export async function submitClaim(formData: FormData) {
  const user = await requireMember("/directory/claim");
  const listingName = String(formData.get("listing_name") ?? "").trim();
  const listingSlug = String(formData.get("listing_slug") ?? "").trim();
  const listingId = String(formData.get("listing_id") ?? "").trim();
  const evidence = String(formData.get("evidence") ?? "").trim();
  if (!listingName || evidence.length < 8) {
    redirect("/directory/claim?error=Tell+us+how+you+can+prove+this+is+your+business.");
  }
  const supabase = await createClient();
  if (!supabase) redirect("/directory/claim?error=Could+not+send+that+claim.");
  const { error } = await supabase.from("listing_claims").insert({
    listing_id: listingId || null,
    listing_name: listingName,
    listing_slug: listingSlug || null,
    user_id: user.id,
    evidence,
  });
  if (error) redirect(`/directory/claim?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/claims");
  redirect("/directory/claim?done=1");
}

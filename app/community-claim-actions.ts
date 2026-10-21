"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCommunityById } from "@/lib/communities";
import { createEventStub } from "@/lib/events";
import { tidyCellphone } from "@/lib/phone";
import { portalEventHref } from "@/lib/portal";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function areasFrom(raw: string) {
  return [...new Set(raw.split(/[\n,]/).map((area) => area.trim()).filter(Boolean))].slice(0, 12);
}

export async function registerCommunity(input: {
  title: string;
  about: string;
  areas: string[];
  phone: string;
  contactEmail: string;
  founderName: string;
  founderEmail: string;
  websiteUrl: string;
  instagramUrl: string;
  facebookUrl: string;
  tiktokUrl: string;
}): Promise<{ id: string } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to register a community." };
  const title = input.title.trim();
  const about = input.about.trim();
  const founderName = input.founderName.trim();
  const areas = [...new Set(input.areas.map((area) => area.trim()).filter(Boolean))].slice(0, 12);
  if (!title) return { error: "Give the community a name." };
  if (!about) return { error: "Describe the community." };
  if (!founderName) return { error: "Add the founder's name." };
  const phoneRaw = input.phone.trim();
  const phone = phoneRaw ? tidyCellphone(phoneRaw) : "";
  if (phoneRaw && !phone) return { error: "That contact number does not look right." };
  const contactEmail = input.contactEmail.trim();
  if (!phone && !contactEmail) return { error: "Add a contact email or a contact number." };

  const supabase = await createClient();
  if (!supabase) return { error: "Could not register that community." };
  const { data, error } = await supabase.rpc("register_community", {
    p_title: title,
    p_about: about,
    p_phone: phone,
    p_contact_email: contactEmail,
    p_founder_name: founderName,
    p_founder_email: input.founderEmail.trim(),
    p_place_label: areas[0] ?? "",
    p_website_url: input.websiteUrl.trim(),
    p_instagram_url: input.instagramUrl.trim(),
    p_facebook_url: input.facebookUrl.trim(),
    p_tiktok_url: input.tiktokUrl.trim(),
    p_areas: areas,
  });
  if (error || !data) return { error: error?.message ?? "Could not register that community." };

  revalidatePath("/account/communities");
  revalidatePath("/account/community");
  return { id: String(data) };
}

export async function claimCommunityNow(formData: FormData) {
  const user = await getCurrentUser();
  const id = String(formData.get("id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!user) redirect(`/communities/${slug}/claim`);
  if (!UUID.test(id)) redirect(`/communities/${slug}/claim?error=That+community+could+not+be+claimed.`);
  const supabase = await createClient();
  if (!supabase) redirect(`/communities/${slug}/claim?error=Could+not+claim+that+community.`);
  const { error } = await supabase.rpc("claim_community", { p_community_id: id });
  if (error) redirect(`/communities/${slug}/claim?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/communities/${slug}`);
  revalidatePath("/account/communities");
  redirect(`/account/communities/${id}`);
}

export async function saveClaimedCommunity(formData: FormData) {
  const user = await getCurrentUser();
  const id = String(formData.get("id") ?? "");
  if (!user) redirect(`/login?next=/account/communities/${id}`);
  if (!UUID.test(id)) redirect("/account/communities?error=That+community+could+not+be+saved.");
  const supabase = await createClient();
  if (!supabase) redirect(`/account/communities/${id}?error=Could+not+save+that+community.`);

  const { error } = await supabase.rpc("save_claimed_community", {
    p_community_id: id,
    p_title: String(formData.get("title") ?? ""),
    p_about: String(formData.get("about") ?? ""),
    p_areas: areasFrom(String(formData.get("areas") ?? "")),
    p_contact_email: String(formData.get("contact_email") ?? ""),
    p_phone: String(formData.get("phone") ?? ""),
    p_website_url: String(formData.get("website_url") ?? ""),
    p_instagram_url: String(formData.get("instagram_url") ?? ""),
    p_facebook_url: String(formData.get("facebook_url") ?? ""),
    p_tiktok_url: String(formData.get("tiktok_url") ?? ""),
    p_founder_name: String(formData.get("founder_name") ?? ""),
    p_founder_email: String(formData.get("founder_email") ?? ""),
  });
  if (error) redirect(`/account/communities/${id}?error=${encodeURIComponent(error.message)}`);

  const community = await getCommunityById(id);
  if (community) revalidatePath(`/communities/${community.slug}`);
  revalidatePath("/account/communities");
  revalidatePath(`/account/communities/${id}`);
  redirect(`/account/communities/${id}?done=1`);
}

export async function addClaimedCommunityEvent(formData: FormData) {
  const user = await getCurrentUser();
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!user) redirect(`/login?next=/account/communities/${id}`);
  if (!UUID.test(id)) redirect("/account/communities?error=That+event+could+not+be+added.");
  const community = await getCommunityById(id);
  if (!community || community.claimedBy !== user.id) {
    redirect(`/account/communities/${id}?error=You+can+only+add+events+to+a+community+you+have+claimed.`);
  }
  if (!title) redirect(`/account/communities/${id}?error=Give+the+event+a+name.`);
  let event: { id: string; slug: string };
  try {
    event = await createEventStub(user.id, title);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not add that event.";
    redirect(`/account/communities/${id}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(`/account/communities/${id}`);
  redirect(portalEventHref(event.id));
}

import { createClient } from "@/lib/supabase/server";
import type { OrganiserProfile } from "@/lib/host-profile-shared";

export type { OrganiserProfile } from "@/lib/host-profile-shared";
export {
  EMPTY_ORGANISER_PROFILE,
  HOST_BANNER_SPEC,
  defaultOrganiserProfile,
  parseOrganiserProfileInput,
} from "@/lib/host-profile-shared";

function asNullable(value: string) {
  return value || null;
}

export async function loadOrganiserProfile(userId: string): Promise<OrganiserProfile | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("organiser_profiles")
    .select(
      "host_name, contact_email, description, banner_url, telephone, telephone_public, mobile, mobile_public, address_line1, address_line2, suburb, city, postal_code, facebook_url, website_url, instagram_url, spotify_url, x_handle",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return null;

  return {
    hostName: data.host_name ?? "",
    contactEmail: data.contact_email ?? "",
    description: data.description ?? "",
    bannerUrl: data.banner_url ?? "",
    telephone: data.telephone ?? "",
    telephonePublic: Boolean(data.telephone_public),
    mobile: data.mobile ?? "",
    mobilePublic: Boolean(data.mobile_public),
    addressLine1: data.address_line1 ?? "",
    addressLine2: data.address_line2 ?? "",
    suburb: data.suburb ?? "",
    city: data.city ?? "",
    postalCode: data.postal_code ?? "",
    facebookUrl: data.facebook_url ?? "",
    websiteUrl: data.website_url ?? "",
    instagramUrl: data.instagram_url ?? "",
    spotifyUrl: data.spotify_url ?? "",
    xHandle: data.x_handle ?? "",
  };
}

export async function saveOrganiserProfile(userId: string, profile: OrganiserProfile) {
  const supabase = await createClient();
  if (!supabase) throw new Error("Supabase is not connected.");

  const { error } = await supabase.from("organiser_profiles").upsert({
    user_id: userId,
    host_name: profile.hostName,
    contact_email: asNullable(profile.contactEmail),
    description: asNullable(profile.description),
    banner_url: asNullable(profile.bannerUrl),
    telephone: asNullable(profile.telephone),
    telephone_public: profile.telephonePublic,
    mobile: asNullable(profile.mobile),
    mobile_public: profile.mobilePublic,
    address_line1: asNullable(profile.addressLine1),
    address_line2: asNullable(profile.addressLine2),
    suburb: asNullable(profile.suburb),
    city: asNullable(profile.city),
    postal_code: asNullable(profile.postalCode),
    facebook_url: asNullable(profile.facebookUrl),
    website_url: asNullable(profile.websiteUrl),
    instagram_url: asNullable(profile.instagramUrl),
    spotify_url: asNullable(profile.spotifyUrl),
    x_handle: asNullable(profile.xHandle),
    updated_at: new Date().toISOString(),
  });

  if (error) throw new Error(error.message);
}

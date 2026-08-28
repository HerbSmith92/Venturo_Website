"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { isListingAction } from "@/lib/control-room-shared";
import { draftToPayload, type ListingDraft } from "@/lib/listing-draft";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import type { AppRole } from "@/lib/roles";

export async function saveListingDraft(listingId: string, draft: ListingDraft) {
  await requireAdmin();
  const supabase = await createClient();
  if (!supabase || !listingId) {
    return { ok: false as const, error: "Could not save that listing." };
  }
  if (!draft.name.trim()) {
    return { ok: false as const, error: "Listing name is required." };
  }

  const { error } = await supabase.rpc("admin_save_listing_draft", {
    p_listing_id: listingId,
    p_payload: draftToPayload(draft),
  });

  if (error) {
    return { ok: false as const, error: error.message };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/listings");
  revalidatePath(`/admin/listings/${listingId}`);
  revalidatePath("/");
  revalidatePath("/directory");
  return { ok: true as const };
}

function mediaExt(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && ["jpg", "jpeg", "png", "webp", "gif"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  return "jpg";
}

export async function uploadListingPhoto(listingId: string, formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  if (!supabase || !listingId) {
    return { ok: false as const, error: "Could not upload that photo." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false as const, error: "Choose an image to upload." };
  }
  if (!file.type.startsWith("image/")) {
    return { ok: false as const, error: "Photos must be an image file." };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { ok: false as const, error: "Keep photos under 10 MB." };
  }

  const { data: existing } = await supabase
    .from("listing_media")
    .select("id, sort_order, is_cover")
    .eq("listing_id", listingId)
    .order("sort_order", { ascending: true });

  const nextOrder =
    existing && existing.length
      ? Math.max(...existing.map((row) => row.sort_order ?? 0)) + 1
      : 0;
  const makeCover = !existing?.some((row) => row.is_cover);

  const ext = mediaExt(file);
  const storageKey = `${listingId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("listing-media")
    .upload(storageKey, file, {
      cacheControl: "3600",
      contentType: file.type || `image/${ext}`,
      upsert: false,
    });

  if (uploadError) {
    return { ok: false as const, error: uploadError.message };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("listing-media").getPublicUrl(storageKey);

  const { data: row, error: insertError } = await supabase
    .from("listing_media")
    .insert({
      listing_id: listingId,
      media_type: "image",
      storage_key: storageKey,
      public_url: publicUrl,
      alt_text: file.name.replace(/\.[^.]+$/, "").slice(0, 120) || null,
      copyright_status: "owned",
      is_cover: makeCover,
      sort_order: nextOrder,
    })
    .select("id, public_url, is_cover, sort_order, alt_text, storage_key")
    .single();

  if (insertError || !row) {
    await supabase.storage.from("listing-media").remove([storageKey]);
    return {
      ok: false as const,
      error: insertError?.message ?? "Could not save the photo row.",
    };
  }

  revalidatePath(`/admin/listings/${listingId}`);
  return {
    ok: true as const,
    media: {
      id: row.id as string,
      public_url: row.public_url as string,
      is_cover: Boolean(row.is_cover),
      sort_order: (row.sort_order as number) ?? nextOrder,
      alt_text: (row.alt_text as string | null) ?? "",
    },
  };
}

export async function deleteListingPhoto(listingId: string, mediaId: string) {
  await requireAdmin();
  const supabase = await createClient();
  if (!supabase || !listingId || !mediaId) {
    return { ok: false as const, error: "Could not delete that photo." };
  }

  const { data: row, error: loadError } = await supabase
    .from("listing_media")
    .select("id, storage_key, is_cover")
    .eq("listing_id", listingId)
    .eq("id", mediaId)
    .maybeSingle();

  if (loadError || !row) {
    return { ok: false as const, error: loadError?.message ?? "Photo not found." };
  }

  const { error: deleteError } = await supabase
    .from("listing_media")
    .delete()
    .eq("id", mediaId)
    .eq("listing_id", listingId);

  if (deleteError) {
    return { ok: false as const, error: deleteError.message };
  }

  if (row.storage_key) {
    await supabase.storage.from("listing-media").remove([row.storage_key]);
  }

  if (row.is_cover) {
    const { data: next } = await supabase
      .from("listing_media")
      .select("id")
      .eq("listing_id", listingId)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (next?.id) {
      await supabase
        .from("listing_media")
        .update({ is_cover: true })
        .eq("id", next.id)
        .eq("listing_id", listingId);
    }
  }

  revalidatePath(`/admin/listings/${listingId}`);
  return { ok: true as const };
}

export async function applyListingAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const action = String(formData.get("action") ?? "");
  const featuredRaw = formData.get("featured");

  if (!supabase || !id || !isListingAction(action)) {
    redirect("/admin/listings?error=That+action+could+not+run.");
  }

  const featured =
    featuredRaw === null || featuredRaw === ""
      ? null
      : String(featuredRaw) === "true";

  const { error } = await supabase.rpc("admin_apply_listing_action", {
    p_listing_id: id,
    p_action: action,
    p_featured: featured,
  });

  if (error) {
    redirect(`/admin/listings/${id}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/listings");
  revalidatePath(`/admin/listings/${id}`);
  revalidatePath("/");
  revalidatePath("/directory");
  redirect(`/admin/listings/${id}?done=${action}`);
}

function asStaffRole(value: string): AppRole | null {
  if (value === "admin" || value === "editor") return value;
  return null;
}

export async function inviteStaff(formData: FormData) {
  await requireAdmin();
  const admin = createServiceClient();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = asStaffRole(String(formData.get("role") ?? ""));
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const origin = host ? `${proto}://${host}` : "";

  if (!admin) {
    redirect("/admin/staff?error=Add+SUPABASE_SERVICE_ROLE_KEY+to+invite+staff.");
  }
  if (!email || !role) {
    redirect("/admin/staff?error=Email+and+role+are+required.");
  }

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: origin ? `${origin}/admin/login` : undefined,
    data: {},
  });

  if (error || !data.user) {
    redirect(`/admin/staff?error=${encodeURIComponent(error?.message ?? "Invite failed.")}`);
  }

  const { error: roleError } = await admin.auth.admin.updateUserById(data.user.id, {
    app_metadata: { role },
  });

  if (roleError) {
    redirect(`/admin/staff?error=${encodeURIComponent(roleError.message)}`);
  }

  revalidatePath("/admin/staff");
  redirect("/admin/staff?done=invited");
}

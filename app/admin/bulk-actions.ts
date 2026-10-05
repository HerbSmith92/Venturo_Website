"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function idsFrom(formData: FormData) {
  return [...new Set(formData.getAll("id").map(String))].filter((id) => UUID.test(id)).slice(0, 100);
}

function destination(formData: FormData, fallback: string) {
  const raw = String(formData.get("return_to") ?? "");
  if (!raw.startsWith("/admin/")) return fallback;
  return raw;
}

function withError(path: string, message: string) {
  const url = new URL(path, "http://local");
  url.searchParams.set("error", message);
  return `${url.pathname}${url.search}`;
}

function choice(formData: FormData) {
  const bulk = String(formData.get("bulk") ?? "");
  return bulk === "archive" || bulk === "delete" ? bulk : null;
}

export async function bulkListingAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const ids = idsFrom(formData);
  const bulk = choice(formData);
  const back = destination(formData, "/admin/listings");
  if (!supabase || !bulk || ids.length === 0) {
    redirect(withError(back, "Choose a bulk action and at least one activity."));
  }

  if (bulk === "delete") {
    const { data, error } = await supabase.from("directory_listings").select("id, status").in("id", ids);
    if (error) redirect(withError(back, error.message));
    const blocked = (data ?? []).filter((row) => row.status !== "archived");
    if (blocked.length || (data ?? []).length !== ids.length) {
      redirect(withError(back, "Only archived activities can be deleted. Archive them first."));
    }
    const { data: media } = await supabase.from("listing_media").select("storage_key").in("listing_id", ids);
    const keys = (media ?? []).map((row) => row.storage_key).filter((key): key is string => Boolean(key));
    for (const id of ids) {
      const { error: deleteError } = await supabase.rpc("admin_delete_archived_listing", { p_listing_id: id });
      if (deleteError) redirect(withError(back, deleteError.message));
    }
    if (keys.length) await supabase.storage.from("listing-media").remove(keys);
  } else {
    for (const id of ids) {
      const { error } = await supabase.rpc("admin_apply_listing_action", {
        p_listing_id: id,
        p_action: "archive",
        p_featured: null,
        p_note: null,
        p_publish_at: null,
      });
      if (error) redirect(withError(back, error.message));
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/listings");
  revalidatePath("/");
  revalidatePath("/directory");
  redirect(back);
}

export async function bulkEventAction(formData: FormData) {
  await requireStaff();
  const supabase = await createClient();
  const ids = idsFrom(formData);
  const bulk = choice(formData);
  const back = destination(formData, "/admin/events");
  if (!supabase || !bulk || ids.length === 0) {
    redirect(withError(back, "Choose a bulk action and at least one event."));
  }

  if (bulk === "archive") {
    const { error } = await supabase.from("events").update({ status: "archived" }).in("id", ids);
    if (error) redirect(withError(back, error.message));
  } else {
    const { error } = await supabase.from("events").delete().in("id", ids);
    if (error) {
      redirect(withError(back, "Some events could not be deleted. Ones with tickets stay on the list."));
    }
  }

  revalidatePath("/admin/events");
  revalidatePath("/events");
  revalidatePath("/");
  redirect(back);
}

export async function bulkCommunityAction(formData: FormData) {
  await requireStaff();
  const supabase = await createClient();
  const ids = idsFrom(formData);
  const bulk = choice(formData);
  const back = destination(formData, "/admin/communities");
  if (!supabase || !bulk || ids.length === 0) {
    redirect(withError(back, "Choose a bulk action and at least one community."));
  }

  if (bulk === "archive") {
    const { error } = await supabase.from("communities").update({ status: "archived" }).in("id", ids);
    if (error) redirect(withError(back, error.message));
  } else {
    const { error } = await supabase.from("communities").delete().in("id", ids);
    if (error) redirect(withError(back, error.message));
  }

  revalidatePath("/admin/communities");
  revalidatePath("/communities");
  revalidatePath("/");
  redirect(back);
}

export async function bulkGuideAction(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const ids = idsFrom(formData);
  const bulk = choice(formData);
  const back = destination(formData, "/admin/guides");
  if (!supabase || !bulk || ids.length === 0) {
    redirect(withError(back, "Choose a bulk action and at least one guide."));
  }

  if (bulk === "archive") {
    for (const id of ids) {
      const { error } = await supabase.rpc("admin_apply_guide_action", {
        p_guide_id: id,
        p_action: "archive",
      });
      if (error) redirect(withError(back, error.message));
    }
  } else {
    for (const id of ids) {
      const { error } = await supabase.rpc("admin_delete_curated_guide", { p_guide_id: id });
      if (error) redirect(withError(back, error.message));
    }
  }

  revalidatePath("/admin/guides");
  revalidatePath("/guides");
  revalidatePath("/");
  redirect(back);
}

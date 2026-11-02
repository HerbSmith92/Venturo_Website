"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendAuthorInviteEmail } from "@/lib/author-invite-email";
import { requireAdmin, requireGuideWriter } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function revalidateAuthors(id?: string) {
  revalidatePath("/admin/authors");
  if (id) revalidatePath(`/admin/authors/${id}`);
  revalidatePath("/guides");
  revalidatePath("/authors");
}

export async function createGuideAuthor() {
  await requireAdmin();
  const supabase = await createClient();
  if (!supabase) {
    redirect("/admin/authors?error=Could+not+create+that+author.");
  }
  const { data, error } = await supabase.rpc("admin_create_guide_author");
  const row = (Array.isArray(data) ? data[0] : data) as { id?: string } | null;
  if (error || !row?.id) {
    redirect(
      `/admin/authors?error=${encodeURIComponent(error?.message ?? "Could not create that author.")}`,
    );
  }
  revalidateAuthors();
  redirect(`/admin/authors/${row.id}`);
}

export async function deleteGuideAuthor(authorId: string) {
  await requireAdmin();
  const supabase = await createClient();
  if (!supabase || !authorId) {
    return { ok: false as const, error: "Could not delete that author." };
  }
  const folder = await supabase.storage.from("guide-authors").list(authorId);
  if (folder.data?.length) {
    await supabase.storage.from("guide-authors").remove(folder.data.map((file) => `${authorId}/${file.name}`));
  }
  const { error } = await supabase.rpc("admin_delete_guide_author", {
    p_author_id: authorId,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidateAuthors(authorId);
  return { ok: true as const };
}

export async function saveGuideAuthorAsset(
  authorId: string,
  slot: "photo" | "cover",
  url: string,
  storageKey: string,
) {
  await requireGuideWriter();
  const supabase = await createClient();
  if (!supabase || !authorId || !url.trim() || !storageKey.trim()) {
    return { ok: false as const, error: "Could not save that photo." };
  }
  const { error } = await supabase.rpc("admin_save_guide_author_asset", {
    p_author_id: authorId,
    p_slot: slot,
    p_url: url.trim(),
    p_storage_key: storageKey.trim(),
  });
  if (error) return { ok: false as const, error: error.message };
  revalidateAuthors(authorId);
  return { ok: true as const };
}

export async function saveGuideAuthor(
  authorId: string,
  draft: {
    display_name: string;
    tagline: string;
    bio: string;
    photo_url: string;
    photo_storage_key: string;
    cover_url: string;
    cover_storage_key: string;
    instagram_url: string;
    tiktok_url: string;
    facebook_url: string;
    website_url: string;
    user_id: string;
  },
) {
  await requireGuideWriter();
  const supabase = await createClient();
  if (!supabase || !authorId) {
    return { ok: false as const, error: "Could not save that author." };
  }
  if (!draft.display_name.trim()) {
    return { ok: false as const, error: "Author name is required." };
  }
  const { error } = await supabase.rpc("admin_save_guide_author", {
    p_author_id: authorId,
    p_payload: draft,
  });
  if (error) {
    if (/already linked to another author/i.test(error.message) || /guide_authors_user_id_key/i.test(error.message)) {
      return { ok: false as const, error: "That staff login is already linked to another author. Leave it unlinked, or unlink it on the other profile first." };
    }
    return { ok: false as const, error: error.message };
  }
  revalidateAuthors(authorId);
  return { ok: true as const };
}

async function requestOrigin() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : "";
}

async function mintGuideAuthorInvite(email?: string) {
  await requireAdmin();
  const supabase = await createClient();
  if (!supabase) {
    return { ok: false as const, error: "Could not create that invite." };
  }
  const { data, error } = await supabase.rpc("admin_create_guide_author_invite", {
    p_email: email?.trim().toLowerCase() || null,
  });
  const row = (typeof data === "string" ? JSON.parse(data) : data) as {
    token?: string;
    expires_at?: string;
  } | null;
  if (error || !row?.token) {
    return { ok: false as const, error: error?.message ?? "Could not create that invite." };
  }
  const origin = await requestOrigin();
  return {
    ok: true as const,
    url: `${origin}/authors/join/${row.token}`,
    expiresAt: row.expires_at ?? null,
  };
}

export async function createGuideAuthorInvite() {
  return mintGuideAuthorInvite();
}

export async function emailGuideAuthorInvite(email: string) {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) {
    return { ok: false as const, error: "Enter a valid email." };
  }
  const invite = await mintGuideAuthorInvite(trimmed);
  if (!invite.ok) return invite;
  const sent = await sendAuthorInviteEmail(trimmed, invite.url);
  if (!sent.ok) {
    return { ok: true as const, url: invite.url, expiresAt: invite.expiresAt, emailed: false, error: sent.error };
  }
  return { ok: true as const, url: invite.url, expiresAt: invite.expiresAt, emailed: true };
}

export async function claimGuideAuthorInvite(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  const supabase = await createClient();
  if (!supabase || !token) {
    redirect("/authors?error=That+invite+is+not+valid.");
  }
  const { data, error } = await supabase.rpc("claim_guide_author_invite", {
    p_token: token,
  });
  if (error || !data) {
    redirect(`/authors/join/${encodeURIComponent(token)}?error=${encodeURIComponent(error?.message ?? "Could not claim that invite.")}`);
  }
  const authorId = String(data);
  revalidateAuthors(authorId);
  redirect(`/admin/authors/${authorId}`);
}

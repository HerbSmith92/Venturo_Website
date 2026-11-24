import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

function mediaExt(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Log in to update your photo." }, { status: 401 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not connected yet." }, { status: 503 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const kind = form.get("kind") === "cover" ? "cover" : "avatar";
  const column = kind === "cover" ? "cover_path" : "avatar_path";
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a photo to upload." }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: "Use a JPG, PNG, or WebP photo." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Keep photos under 5 MB." }, { status: 400 });
  }

  const ext = mediaExt(file);
  const path = `${user.id}/${kind}.${ext}`;

  const { data: existing } = await supabase
    .from("profiles")
    .select("avatar_path, cover_path")
    .eq("id", user.id)
    .maybeSingle();

  const previousPath = kind === "cover" ? existing?.cover_path : existing?.avatar_path;

  const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: true,
  });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 400 });
  }

  if (previousPath && previousPath !== path) {
    await supabase.storage.from("avatars").remove([previousPath]);
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      [column]: path,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  const { data: signed, error: signError } = await supabase.storage
    .from("avatars")
    .createSignedUrl(path, 60 * 60);

  if (signError || !signed?.signedUrl) {
    return NextResponse.json(
      { error: signError?.message ?? "Photo saved, but preview failed." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    kind,
    avatarPath: kind === "avatar" ? path : null,
    avatarUrl: kind === "avatar" ? signed.signedUrl : null,
    coverPath: kind === "cover" ? path : null,
    coverUrl: kind === "cover" ? signed.signedUrl : null,
  });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Log in to update your photo." }, { status: 401 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not connected yet." }, { status: 503 });
  }

  const kind = new URL(request.url).searchParams.get("kind") === "cover" ? "cover" : "avatar";
  const column = kind === "cover" ? "cover_path" : "avatar_path";
  const { data: existing } = await supabase
    .from("profiles")
    .select("avatar_path, cover_path")
    .eq("id", user.id)
    .maybeSingle();

  const path = kind === "cover" ? existing?.cover_path : existing?.avatar_path;
  if (path) {
    await supabase.storage.from("avatars").remove([path]);
  }

  const { error } = await supabase
    .from("profiles")
    .update({ [column]: null })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

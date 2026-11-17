import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { createServiceClient } from "@/lib/supabase/admin";

const TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  const session = await getStaffSession();
  if (!session || !isAdmin(session.role)) {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  const form = await request.formData();
  const bannerId = String(form.get("bannerId") ?? "");
  const file = form.get("file");
  if (!bannerId || !(file instanceof File)) {
    return NextResponse.json({ error: "Choose a banner and image." }, { status: 400 });
  }

  const extension = TYPES[file.type];
  if (!extension || file.size > 3 * 1024 * 1024) {
    return NextResponse.json({ error: "Use a PNG, JPEG or WebP under 3 MB." }, { status: 400 });
  }

  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "Supabase is not connected." }, { status: 503 });

  const { data: banner } = await service
    .from("app_home_banners")
    .select("id, image_path, screen")
    .eq("id", bannerId)
    .maybeSingle();
  if (!banner) return NextResponse.json({ error: "Banner not found." }, { status: 404 });

  const objectPath = `${banner.screen}/${bannerId}/banner-${Date.now()}.${extension}`;
  const { error: uploadError } = await service.storage
    .from("app-home")
    .upload(objectPath, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

  const { data: publicUrl } = service.storage.from("app-home").getPublicUrl(objectPath);
  const url = `${publicUrl.publicUrl}?v=${Date.now()}`;
  const { error: updateError } = await service
    .from("app_home_banners")
    .update({
      image_path: url,
      updated_at: new Date().toISOString(),
      updated_by: session.id,
    })
    .eq("id", bannerId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  if (banner.image_path?.includes("/app-home/")) {
    const previous = banner.image_path.split("/app-home/").pop()?.split("?")[0];
    if (previous) await service.storage.from("app-home").remove([previous]);
  }

  return NextResponse.json({ ok: true, url });
}

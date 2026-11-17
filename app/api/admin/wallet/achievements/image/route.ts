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
  const achievementId = String(form.get("achievementId") ?? "");
  const file = form.get("file");
  if (!achievementId || !(file instanceof File)) {
    return NextResponse.json({ error: "Choose an achievement and image." }, { status: 400 });
  }

  const extension = TYPES[file.type];
  if (!extension || file.size > 1024 * 1024) {
    return NextResponse.json({ error: "Use a PNG, JPEG or WebP under 1 MB." }, { status: 400 });
  }

  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "Supabase is not connected." }, { status: 503 });

  const { data: row } = await service
    .from("achievements")
    .select("id, image_path")
    .eq("id", achievementId)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "Achievement not found." }, { status: 404 });

  const objectPath = `achievements/${achievementId}/image-${Date.now()}.${extension}`;
  const { error: uploadError } = await service.storage
    .from("wallet")
    .upload(objectPath, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

  const { data: publicUrl } = service.storage.from("wallet").getPublicUrl(objectPath);
  const url = `${publicUrl.publicUrl}?v=${Date.now()}`;
  const { error } = await service
    .from("achievements")
    .update({
      image_path: url,
      updated_at: new Date().toISOString(),
      updated_by: session.id,
    })
    .eq("id", achievementId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (row.image_path?.includes("/wallet/")) {
    const previous = row.image_path.split("/wallet/").pop()?.split("?")[0];
    if (previous) await service.storage.from("wallet").remove([previous]);
  }

  return NextResponse.json({ ok: true, url });
}

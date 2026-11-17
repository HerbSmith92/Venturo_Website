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
  const entity = String(form.get("entity") ?? "");
  const id = String(form.get("id") ?? "");
  const file = form.get("file");

  if ((entity !== "scale" && entity !== "bucket") || !id || !(file instanceof File)) {
    return NextResponse.json({ error: "Choose a catalogue item and image." }, { status: 400 });
  }

  const extension = TYPES[file.type];
  if (!extension || file.size > 1024 * 1024) {
    return NextResponse.json({ error: "Use a PNG, JPEG or WebP under 1 MB." }, { status: 400 });
  }

  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "Supabase is not connected." }, { status: 503 });

  const table = entity === "scale" ? "activity_scales" : "bucket_items";
  const folder = entity === "scale" ? "adventure-levels" : "bucket-items";

  const { data: row } = await service.from(table).select("id, image_path").eq("id", id).maybeSingle();
  if (!row) return NextResponse.json({ error: "Item not found." }, { status: 404 });

  const objectPath = `${folder}/${id}/image-${Date.now()}.${extension}`;
  const { error: uploadError } = await service.storage
    .from("catalog")
    .upload(objectPath, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

  const { data: publicUrl } = service.storage.from("catalog").getPublicUrl(objectPath);
  const update =
    entity === "scale"
      ? { image_path: publicUrl.publicUrl, updated_at: new Date().toISOString() }
      : { image_path: publicUrl.publicUrl, updated_at: new Date().toISOString() };

  const { error: updateError } = await service.from(table).update(update).eq("id", id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  if (row.image_path?.includes("/catalog/")) {
    const previous = row.image_path.split("/catalog/").pop();
    if (previous) await service.storage.from("catalog").remove([previous]);
  }

  return NextResponse.json({ ok: true, url: `${publicUrl.publicUrl}?v=${Date.now()}` });
}

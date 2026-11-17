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
  const personaId = String(form.get("personaId") ?? "");
  const file = form.get("file");
  if (!personaId || !(file instanceof File)) {
    return NextResponse.json({ error: "Choose an option and image." }, { status: 400 });
  }

  const extension = TYPES[file.type];
  if (!extension || file.size > 1024 * 1024) {
    return NextResponse.json({ error: "Use a PNG, JPEG or WebP under 1 MB." }, { status: 400 });
  }

  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "Supabase is not connected." }, { status: 503 });

  const { data: persona } = await service
    .from("personas")
    .select("id, image_path")
    .eq("id", personaId)
    .maybeSingle();
  if (!persona) return NextResponse.json({ error: "Option not found." }, { status: 404 });

  const objectPath = `personas/${personaId}/image-${Date.now()}.${extension}`;
  const { error: uploadError } = await service.storage
    .from("catalog")
    .upload(objectPath, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

  const { data: publicUrl } = service.storage.from("catalog").getPublicUrl(objectPath);
  const { error: updateError } = await service
    .from("personas")
    .update({ image_path: publicUrl.publicUrl })
    .eq("id", personaId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  if (persona.image_path?.includes("/catalog/")) {
    const previous = persona.image_path.split("/catalog/").pop();
    if (previous) await service.storage.from("catalog").remove([previous]);
  }

  return NextResponse.json({
    ok: true,
    url: `${publicUrl.publicUrl}?v=${Date.now()}`,
  });
}

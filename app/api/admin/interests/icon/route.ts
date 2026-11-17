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
  const interestId = String(form.get("interestId") ?? "");
  const file = form.get("file");
  if (!interestId || !(file instanceof File)) {
    return NextResponse.json({ error: "Choose an interest and image." }, { status: 400 });
  }
  const extension = TYPES[file.type];
  if (!extension || file.size > 1024 * 1024) {
    return NextResponse.json({ error: "Use a PNG, JPEG or WebP under 1 MB." }, { status: 400 });
  }
  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "Supabase is not connected." }, { status: 503 });
  const { data: interest } = await service
    .from("interests")
    .select("id, icon_path")
    .eq("id", interestId)
    .maybeSingle();
  if (!interest) return NextResponse.json({ error: "Interest not found." }, { status: 404 });

  const objectPath = `${interestId}/icon-${Date.now()}.${extension}`;
  const { error: uploadError } = await service.storage
    .from("interest-icons")
    .upload(objectPath, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });
  const { data: publicUrl } = service.storage.from("interest-icons").getPublicUrl(objectPath);
  const { error: updateError } = await service.from("interests").update({
    icon_path: publicUrl.publicUrl,
    image_path: publicUrl.publicUrl,
    icon_version: Date.now(),
    updated_at: new Date().toISOString(),
  }).eq("id", interestId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
  if (interest.icon_path?.includes("/interest-icons/")) {
    const previous = interest.icon_path.split("/interest-icons/").pop();
    if (previous) await service.storage.from("interest-icons").remove([previous]);
  }
  return NextResponse.json({ ok: true, url: publicUrl.publicUrl });
}

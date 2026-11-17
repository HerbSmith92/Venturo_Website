import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { createServiceClient } from "@/lib/supabase/admin";

const TYPES: Record<string, string> = {
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  const session = await getStaffSession();
  if (!session || !isAdmin(session.role)) {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const notes = String(form.get("notes") ?? "").trim().slice(0, 200);
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a transparent PNG or WebP." }, { status: 400 });
  }

  const extension = TYPES[file.type];
  if (!extension || file.size > 1024 * 1024) {
    return NextResponse.json({ error: "Use a PNG or WebP under 1 MB." }, { status: 400 });
  }

  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "Supabase is not connected." }, { status: 503 });

  const objectPath = `token/draft-${Date.now()}.${extension}`;
  const { error: uploadError } = await service.storage
    .from("wallet")
    .upload(objectPath, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

  const { data: publicUrl } = service.storage.from("wallet").getPublicUrl(objectPath);
  const url = `${publicUrl.publicUrl}?v=${Date.now()}`;

  const { data, error } = await service
    .from("wallet_token_artwork")
    .insert({
      status: "draft",
      image_path: url,
      file_type: file.type,
      byte_size: file.size,
      notes: notes || null,
      created_by: session.id,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, artwork: data });
}

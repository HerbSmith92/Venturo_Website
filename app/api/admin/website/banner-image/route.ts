import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { bustPublicCatalog } from "@/lib/public-cache";
import { isStaff } from "@/lib/roles";
import { createServiceClient } from "@/lib/supabase/admin";
import { isWebsiteBannerPage, WEBSITE_BANNER_PAGES } from "@/lib/website-banners";
import { revalidatePath } from "next/cache";

const TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  const session = await getStaffSession();
  if (!session || !isStaff(session.role)) {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }

  const form = await request.formData();
  const page = String(form.get("page") ?? "");
  const file = form.get("file");
  if (!isWebsiteBannerPage(page) || !(file instanceof File)) {
    return NextResponse.json({ error: "Choose a page and image." }, { status: 400 });
  }

  const extension = TYPES[file.type];
  if (!extension || file.size > 3 * 1024 * 1024) {
    return NextResponse.json({ error: "Use a PNG, JPEG or WebP under 3 MB." }, { status: 400 });
  }

  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "Supabase is not connected." }, { status: 503 });

  const meta = WEBSITE_BANNER_PAGES[page];
  const { data: current } = await service
    .from("website_settings")
    .select(meta.imageColumn)
    .eq("id", 1)
    .maybeSingle();

  const objectPath = `banners/${page}/${Date.now()}.${extension}`;
  const { error: uploadError } = await service.storage
    .from("website")
    .upload(objectPath, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

  const { data: publicUrl } = service.storage.from("website").getPublicUrl(objectPath);
  const url = `${publicUrl.publicUrl}?v=${Date.now()}`;
  const { error: updateError } = await service.from("website_settings").upsert({
    id: 1,
    [meta.imageColumn]: url,
    updated_at: new Date().toISOString(),
    updated_by: session.id,
  });
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  const previous = current ? String((current as Record<string, unknown>)[meta.imageColumn] ?? "") : "";
  if (previous.includes("/website/")) {
    const oldPath = previous.split("/website/").pop()?.split("?")[0];
    if (oldPath) await service.storage.from("website").remove([oldPath]);
  }

  bustPublicCatalog();
  revalidatePath(meta.publicPath);
  revalidatePath("/admin/website");
  revalidatePath(`/admin/website/banners/${page}`);

  return NextResponse.json({ ok: true, url });
}

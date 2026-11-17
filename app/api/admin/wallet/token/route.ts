import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { createServiceClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const session = await getStaffSession();
  if (!session || !isAdmin(session.role)) {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "Supabase is not connected." }, { status: 503 });

  const body = (await request.json()) as {
    action?: "publish" | "restore" | "archive";
    id?: string;
  };

  if (!body.id) return NextResponse.json({ error: "Missing artwork id." }, { status: 400 });

  if (body.action === "archive") {
    const { error } = await service
      .from("wallet_token_artwork")
      .update({ status: "archived" })
      .eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "publish" || body.action === "restore") {
    const { data: target } = await service
      .from("wallet_token_artwork")
      .select("*")
      .eq("id", body.id)
      .maybeSingle();
    if (!target) return NextResponse.json({ error: "Artwork not found." }, { status: 404 });

    await service
      .from("wallet_token_artwork")
      .update({ status: "archived" })
      .eq("status", "published");

    const { error } = await service
      .from("wallet_token_artwork")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        published_by: session.id,
      })
      .eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

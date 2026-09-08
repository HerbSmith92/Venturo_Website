import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const body = (await request.json()) as { name?: string; phone?: string };
  const admin = createServiceClient();
  if (!admin) {
    return NextResponse.json({ error: "Could not accept that invite yet." }, { status: 503 });
  }

  const { data, error } = await admin.rpc("accept_event_invite", {
    p_token: token,
    p_name: (body.name ?? "").trim() || null,
    p_phone: (body.phone ?? "").trim() || null,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  const row = (data ?? {}) as { code?: string };
  return NextResponse.json({ ok: true, code: row.code ?? null });
}

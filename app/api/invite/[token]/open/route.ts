import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Could not open that invite." }, { status: 503 });
  }

  const { error } = await supabase.rpc("open_event_invite", { p_token: token });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

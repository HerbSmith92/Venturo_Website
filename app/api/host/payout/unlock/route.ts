import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Log in first." }, { status: 401 });
  }

  const body = (await request.json()) as { email?: string; token?: string };
  const email = (body.email ?? user.email ?? "").trim().toLowerCase();
  const token = (body.token ?? "").trim();
  if (!email || !token) {
    return NextResponse.json({ error: "Email and code are required." }, { status: 400 });
  }
  if (user.email && email !== user.email.toLowerCase()) {
    return NextResponse.json({ error: "Use the email on this host login." }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not connected." }, { status: 503 });
  }

  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

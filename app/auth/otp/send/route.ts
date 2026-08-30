import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not connected yet." },
      { status: 503 },
    );
  }

  const form = await request.formData();
  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase();
  const firstName = String(form.get("firstName") ?? "").trim();
  const mode = String(form.get("mode") ?? "login");
  const nextRaw = String(form.get("next") ?? "/directory");
  const next =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/directory";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  if (mode === "signup" && !firstName) {
    return NextResponse.json({ error: "First name is required." }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  // Magic-link fallback while the project email template is switched to OTP.
  // Once the Magic Link template uses {{ .Token }}, the email shows a 6-digit code.
  const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      data: firstName ? { first_name: firstName } : undefined,
      emailRedirectTo,
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ email });
}

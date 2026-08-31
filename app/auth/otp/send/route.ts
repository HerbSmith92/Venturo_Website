import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/member-auth";

function loginUnknownMessage(message: string) {
  const lower = message.toLowerCase();
  if (
    lower.includes("signups not allowed") ||
    lower.includes("user not found") ||
    lower.includes("unable to validate email")
  ) {
    return "No profile for that email yet. Sign up free first.";
  }
  return message;
}

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
  const next = safeNextPath(form.get("next"));

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  if (mode === "signup" && !firstName) {
    return NextResponse.json({ error: "First name is required." }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: mode !== "login",
      data: firstName ? { first_name: firstName } : undefined,
      emailRedirectTo,
    },
  });

  if (error) {
    return NextResponse.json(
      { error: mode === "login" ? loginUnknownMessage(error.message) : error.message },
      { status: 400 },
    );
  }

  return NextResponse.json({ email });
}

import { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/member-auth";
import { createClient } from "@/lib/supabase/server";

function loginFailureMessage(message: string) {
  const lower = message.toLowerCase();
  if (
    lower.includes("invalid login credentials") ||
    lower.includes("invalid email or password")
  ) {
    return "Wrong email or password. If you joined on the old site, use Forgot password to set one first.";
  }
  if (
    lower.includes("email not confirmed") ||
    lower.includes("email_not_confirmed")
  ) {
    return "Confirm your email with the one-time code we send next, or use Forgot password.";
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
  const password = String(form.get("password") ?? "");
  const firstName = String(form.get("firstName") ?? "").trim();
  const mode = String(form.get("mode") ?? "login");
  const next = safeNextPath(form.get("next"));

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Use a password with at least 8 characters." },
      { status: 400 },
    );
  }
  if (mode === "signup" && !firstName) {
    return NextResponse.json({ error: "First name is required." }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

  if (mode === "signup") {
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName },
        emailRedirectTo,
      },
    });
    if (signUpError) {
      const lower = signUpError.message.toLowerCase();
      if (lower.includes("already") || lower.includes("registered")) {
        return NextResponse.json(
          { error: "That email already has a profile. Log in instead." },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: signUpError.message }, { status: 400 });
    }
  } else {
    const { error: passwordError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (passwordError) {
      return NextResponse.json(
        { error: loginFailureMessage(passwordError.message) },
        { status: 400 },
      );
    }
  }

  // Drop the password session — the one-time code must confirm the login.
  await supabase.auth.signOut();

  const { error: otpError } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      data: firstName ? { first_name: firstName } : undefined,
      emailRedirectTo,
    },
  });

  if (otpError) {
    return NextResponse.json(
      {
        error:
          mode === "login"
            ? loginFailureMessage(otpError.message)
            : otpError.message,
      },
      { status: 400 },
    );
  }

  return NextResponse.json({ email });
}

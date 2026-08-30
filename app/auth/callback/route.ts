import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = url.searchParams.get("next") ?? "/directory";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/directory";
  const authError = url.searchParams.get("error_description") ?? url.searchParams.get("error");

  const target = new URL(safeNext, url.origin);
  if (authError) {
    target.searchParams.set("error", authError);
    return NextResponse.redirect(target);
  }

  const supabase = await createClient();
  if (supabase && code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      target.searchParams.set("error", error.message);
      return NextResponse.redirect(target);
    }
    const userId = data.user?.id ?? data.session?.user?.id;
    if (userId) {
      await supabase.rpc("ensure_member_role", { target: userId });
    }
    return NextResponse.redirect(target);
  }

  if (supabase && tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "email" | "signup" | "invite" | "magiclink" | "recovery" | "email_change",
    });
    if (error) {
      target.searchParams.set("error", error.message);
      return NextResponse.redirect(target);
    }
    const userId = data.user?.id ?? data.session?.user?.id;
    if (userId) {
      await supabase.rpc("ensure_member_role", { target: userId });
    }
    return NextResponse.redirect(target);
  }

  return NextResponse.redirect(target);
}

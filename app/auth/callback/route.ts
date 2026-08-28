import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = url.searchParams.get("next") ?? "/admin/reset-password";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/admin/reset-password";
  const authError = url.searchParams.get("error_description") ?? url.searchParams.get("error");

  const target = new URL(safeNext, url.origin);
  if (authError) {
    target.searchParams.set("error", authError);
    return NextResponse.redirect(target);
  }

  const supabase = await createClient();
  if (supabase && code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      target.searchParams.set("error", error.message);
      return NextResponse.redirect(target);
    }
    return NextResponse.redirect(target);
  }

  if (tokenHash) {
    target.searchParams.set("token_hash", tokenHash);
    if (type) target.searchParams.set("type", type);
  }

  return NextResponse.redirect(target);
}
